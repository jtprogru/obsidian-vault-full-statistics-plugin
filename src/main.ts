import { TFile, Plugin, debounce, TFolder, WorkspaceLeaf, Notice } from 'obsidian';
import { FolderPickerModal } from './pickers';
import { DecimalUnitFormatter } from './format';
import { FullVaultMetrics } from './metrics';
import { FullVaultMetricsCollector } from './collect';
import { DEFAULT_SETTINGS, FullStatisticsPluginSettings, FullStatisticsPluginSettingTab, statusBarItems } from './settings';
import type { StatusBarStatId } from './settings';
import { HistoryStore, Snapshot, snapshotsToCsv } from './historyStore';
import { VaultStatisticsView, VAULT_STATISTICS_VIEW_TYPE } from './statisticsView';
import { TanglesView, TANGLES_VIEW_TYPE } from './tanglesView';
import { computeTangles, renderTanglesReport, formatDate } from './tangles';
import { setLocale, t } from './i18n';
import { percentString } from './i18n/format';


interface PersistedData {
	settings: Partial<FullStatisticsPluginSettings>;
	history: Snapshot[];
}

function isPersistedData(raw: unknown): raw is PersistedData {
	return !!raw && typeof raw === 'object'
		&& 'settings' in raw
		&& Array.isArray((raw as PersistedData).history);
}

const HISTORY_CSV_FILENAME = 'Vault Statistics — History.csv';

export default class FullStatisticsPlugin extends Plugin {

	private statusBarItem: FullStatisticsStatusBarItem | null = null;

	public vaultMetricsCollector!: FullVaultMetricsCollector;
	public vaultMetrics!: FullVaultMetrics;
	public historyStore!: HistoryStore;

	settings!: FullStatisticsPluginSettings;

	async onload() {
		await this.loadSettings();

		this.vaultMetrics = new FullVaultMetrics();
		this.vaultMetricsCollector = new FullVaultMetricsCollector(this).
			setVault(this.app.vault).
			setMetadataCache(this.app.metadataCache).
			setFullVaultMetrics(this.vaultMetrics).
			setExcludedFolders(this.settings.excludedFolders).
			setOwnTags(this.settings.ownTags).
			setSourceTags(this.settings.sourceTags).
			setConceptTags(this.settings.conceptTags).
			setConceptFolders(this.settings.conceptFolders).
			setInboxFolders(this.settings.inboxFolders).
			setInboxReviewTags(this.settings.inboxReviewTags);

		// Defer the initial vault scan until Obsidian has finished laying
		// out the workspace. start() registers vault/metadata event handlers
		// AND walks every file in the vault — running it inside onload would
		// block Obsidian's startup by hundreds of ms on large vaults.
		// onLayoutReady fires once the UI is interactive, so users see the
		// workspace sooner and the status-bar number lights up shortly after.
		this.app.workspace.onLayoutReady(() => {
			this.vaultMetricsCollector.start();
		});

		this.statusBarItem = new FullStatisticsStatusBarItem(this, this.addStatusBarItem()).
			setFullVaultMetrics(this.vaultMetrics);

		this.addSettingTab(new FullStatisticsPluginSettingTab(this.app, this));

		// History snapshots: hook the metrics-updated event with a long debounce
		// so we sample after the vault has settled rather than mid-backlog.
		this.registerEvent(this.vaultMetrics.on('updated', this.maybeSnapshot));

		this.registerView(VAULT_STATISTICS_VIEW_TYPE, (leaf: WorkspaceLeaf) =>
			new VaultStatisticsView(
				leaf,
				this.vaultMetrics,
				this.vaultMetricsCollector,
				this.historyStore,
				() => this.settings,
			));

		this.registerView(TANGLES_VIEW_TYPE, (leaf: WorkspaceLeaf) =>
			new TanglesView(
				leaf,
				this.vaultMetrics,
				this.vaultMetricsCollector,
				() => this.settings,
				(path: string) => this.excludeFromTangles(path),
			));

		this.addCommand({
			id: 'open-vault-statistics-view',
			name: t().commands.openStatistics,
			callback: () => this.activateStatisticsView(),
		});

		this.addCommand({
			id: 'export-vault-statistics-history',
			name: t().commands.exportHistory,
			callback: () => this.exportHistoryCsv(),
		});

		this.addCommand({
			id: 'open-vault-tangles-view',
			name: t().commands.openTangles,
			callback: () => this.activateTanglesView(),
		});

		this.addCommand({
			id: 'create-vault-tangles-report',
			name: t().commands.createTanglesReport,
			callback: () => this.writeTanglesReport(),
		});

		this.addRibbonIcon('bar-chart', t().commands.ribbonTooltip, () => this.activateStatisticsView());
	}

	async loadSettings() {
		const raw = await this.loadData();
		let storedSettings: Partial<FullStatisticsPluginSettings> | undefined;
		let storedHistory: Snapshot[] = [];

		if (isPersistedData(raw)) {
			storedSettings = raw.settings;
			storedHistory = raw.history;
		} else {
			// Legacy shape: data.json is the settings object directly.
			storedSettings = raw as Partial<FullStatisticsPluginSettings> | undefined;
		}

		this.settings = Object.assign({}, DEFAULT_SETTINGS, storedSettings);
		this.historyStore = new HistoryStore(storedHistory);
		// Before anything renders: views and the status bar read strings at
		// render time, so the locale has to be in place first.
		setLocale(this.settings.language);
	}

	async saveSettings() {
		await this.persist();
		if (this.statusBarItem) {
			this.statusBarItem.refresh();
		}
		// Bump generation so memoized aggregates (folder groups, inbox
		// health) rebuild with the new settings; then re-fire so the
		// sidebar view re-renders without waiting for the next metrics
		// update.
		this.vaultMetricsCollector?.bumpGeneration();
		this.vaultMetrics?.trigger('updated');
	}

	private async persist() {
		const payload: PersistedData = {
			settings: this.settings,
			history: this.historyStore.all(),
		};
		await this.saveData(payload);
	}

	private maybeSnapshot = debounce(() => {
		const changed = this.historyStore.recordIfNeeded(new Date(), this.vaultMetrics);
		if (changed) {
			void this.persist();
		}
	}, 10000, false);

	private async exportHistoryCsv() {
		const snapshots = this.historyStore.all();
		if (snapshots.length === 0) {
			new Notice(t().notices.noHistory);
			return;
		}
		const csv = snapshotsToCsv(snapshots);

		// Prefer the native OS save dialog (File System Access API) so the
		// user can write anywhere on disk, not just inside the vault.
		// Falls back to the in-vault folder picker on platforms where the
		// API is unavailable (mobile, sandboxed builds).
		type SaveFilePickerOptions = {
			suggestedName?: string;
			types?: Array<{ description?: string; accept: Record<string, string[]> }>;
		};
		type FileSystemWritableStream = { write(data: string): Promise<void>; close(): Promise<void> };
		type FileSystemFileHandle = { name: string; createWritable(): Promise<FileSystemWritableStream> };
		type ShowSaveFilePicker = (opts: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
		const nativePicker = (window as Window & { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker;
		if (typeof nativePicker === 'function') {
			try {
				const handle = await nativePicker.call(window, {
					suggestedName: HISTORY_CSV_FILENAME,
					types: [{
						description: t().notices.csvFileType,
						accept: { 'text/csv': ['.csv'] },
					}],
				});
				const writable = await handle.createWritable();
				await writable.write(csv);
				await writable.close();
				new Notice(t().notices.exported(snapshots.length, handle.name));
				return;
			} catch (e) {
				if (e instanceof DOMException && e.name === 'AbortError') return; // user cancelled
				console.error('vault-statistics: native save dialog failed', e);
				// Fall through to in-vault fallback
			}
		}

		new FolderPickerModal(this.app, (folder) => {
			void this.writeVaultCsv(folder, csv, snapshots.length);
		}, t().notices.chooseCsvFolder).open();
	}

	private async writeVaultCsv(folder: TFolder, csv: string, count: number) {
		const dir = folder.path === '' || folder.path === '/' ? '' : folder.path;
		const path = dir ? `${dir}/${HISTORY_CSV_FILENAME}` : HISTORY_CSV_FILENAME;
		try {
			const existing = this.app.vault.getAbstractFileByPath(path);
			if (existing instanceof TFile) {
				// Vault.process is the atomic read-modify-write per Obsidian
				// guidelines — safer than `modify` when other writers may
				// touch the file mid-export.
				await this.app.vault.process(existing, () => csv);
			} else {
				await this.app.vault.create(path, csv);
			}
			this.settings.historyExportFolder = dir;
			await this.persist();
			new Notice(t().notices.exported(count, path));
		} catch (e) {
			console.error('vault-statistics: csv export failed', e);
			new Notice(t().notices.exportFailed(e instanceof Error ? e.message : String(e)));
		}
	}

	private async activateStatisticsView() {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VAULT_STATISTICS_VIEW_TYPE);
		let leaf: WorkspaceLeaf | null;
		if (existing.length > 0) {
			leaf = existing[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: VAULT_STATISTICS_VIEW_TYPE, active: true });
			}
		}
		if (leaf) await workspace.revealLeaf(leaf);
	}

	private async excludeFromTangles(path: string): Promise<void> {
		// Settings UI also accepts folder prefixes, so we use an exact-path
		// match here — adding the full path of the clicked note. Users can
		// later widen this to a folder prefix in settings if they want.
		if (this.settings.tanglesExclude.includes(path)) return;
		this.settings.tanglesExclude = [...this.settings.tanglesExclude, path];
		await this.saveSettings();
		new Notice(t().notices.excludedFromTangles(path));
	}

	private async activateTanglesView() {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(TANGLES_VIEW_TYPE);
		let leaf: WorkspaceLeaf | null;
		if (existing.length > 0) {
			leaf = existing[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: TANGLES_VIEW_TYPE, active: true });
			}
		}
		if (leaf) await workspace.revealLeaf(leaf);
	}

	private async writeTanglesReport() {
		const entries = computeTangles(this.vaultMetricsCollector, this.settings);
		const now = new Date();
		const body = renderTanglesReport(entries, this.settings, now);

		const folder = this.settings.tanglesReportFolder.trim().replace(/\/+$/, '');
		if (folder) {
			const existing = this.app.vault.getAbstractFileByPath(folder);
			if (!existing) {
				try {
					await this.app.vault.createFolder(folder);
				} catch (e) {
					console.error('vault-statistics: failed to create tangles report folder', e);
					new Notice(t().notices.folderCreateFailed(folder, e instanceof Error ? e.message : String(e)));
					return;
				}
			}
		}

		const filename = t().tangles.reportFileName(formatDate(now));
		const targetPath = await this.uniqueReportPath(folder, filename);
		try {
			const created = await this.app.vault.create(targetPath, body);
			new Notice(t().notices.tanglesSaved(entries.length, targetPath));
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.openFile(created);
		} catch (e) {
			console.error('vault-statistics: tangles report write failed', e);
			new Notice(t().notices.tanglesReportFailed(e instanceof Error ? e.message : String(e)));
		}
	}

	// app.vault.create() rejects when the target path already exists, so we
	// probe and append a counter suffix instead of relying on the user
	// retrying. Two reports in the same minute would otherwise collide.
	private async uniqueReportPath(folder: string, filename: string): Promise<string> {
		const join = (name: string) => folder ? `${folder}/${name}` : name;
		const dot = filename.lastIndexOf('.');
		const stem = dot === -1 ? filename : filename.slice(0, dot);
		const ext = dot === -1 ? '' : filename.slice(dot);
		let candidate = join(filename);
		let counter = 2;
		while (this.app.vault.getAbstractFileByPath(candidate)) {
			candidate = join(`${stem} (${counter})${ext}`);
			counter++;
		}
		return candidate;
	}

	public restartCollector() {
		this.vaultMetricsCollector
			.setExcludedFolders(this.settings.excludedFolders)
			.setOwnTags(this.settings.ownTags)
			.setSourceTags(this.settings.sourceTags)
			.setConceptTags(this.settings.conceptTags)
			.setConceptFolders(this.settings.conceptFolders)
			.setInboxFolders(this.settings.inboxFolders)
			.setInboxReviewTags(this.settings.inboxReviewTags)
			.restart();
	}
}

/**
 * {@link StatisticView} is responsible for maintaining the DOM representation
 * of a given statistic.
 */
class StatisticView {

	/** Root node for the {@link StatisticView}. */
	private containerElementsForVaultFullStatistics: HTMLElement;

	/** Formatter that extracts and formats a value from a {@link Statistics} instance. */
	private formatter!: (s: FullVaultMetrics) => string;

	/**
	 * Constructor.
	 *
	 * @param containerEl The parent element for the view.
	 */
	constructor(containerEl: HTMLElement) {
		this.containerElementsForVaultFullStatistics = containerEl.createSpan({ cls: ["obsidian-vault-full-statistics--item"] });
		this.setActive(false);
	}

	/**
	 * Tags the view with its stable identifier, which reaches the user as a CSS
	 * class. This is not a label: the visible text comes from the formatter and
	 * follows the interface language, while the id stays English forever
	 * because people write snippets against these classes.
	 */
	setStatisticId(id: StatusBarStatId): StatisticView {
		this.containerElementsForVaultFullStatistics.addClass(`obsidian-vault-full-statistics--item-${id}`);
		return this;
	}

	/**
	 * Sets the formatter to use to produce the content of the view.
	 */
	setFormatter(formatter: (s: FullVaultMetrics) => string): StatisticView {
		this.formatter = formatter;
		return this;
	}

	/**
	 * Updates the view with the desired active status.
	 *
	 * Active views have the CSS class `obsidian-vault-full-statistics--item-active`
	 * applied, inactive views have the CSS class
	 * `obsidian-vault-full-statistics--item-inactive` applied. These classes are
	 * mutually exclusive.
	 */
	setActive(isActive: boolean): StatisticView {
		this.containerElementsForVaultFullStatistics.removeClass("obsidian-vault-full-statistics--item--active");
		this.containerElementsForVaultFullStatistics.removeClass("obsidian-vault-full-statistics--item--inactive");

		if (isActive) {
			this.containerElementsForVaultFullStatistics.addClass("obsidian-vault-full-statistics--item--active");
		} else {
			this.containerElementsForVaultFullStatistics.addClass("obsidian-vault-full-statistics--item--inactive");
		}

		return this;
	}

	/**
	 * Refreshes the view with the content from the passed {@link
	 * Statistics}.
	 */
	refresh(s: FullVaultMetrics) {
		this.containerElementsForVaultFullStatistics.setText(this.formatter(s));
	}

	/**
	 * Returns the text content of the view.
	 */
	getText(): string {
		return this.containerElementsForVaultFullStatistics.getText();
	}
}

/**
 * How each statistic turns metrics into text, keyed by the same id the settings
 * tab uses. Formatters are looked up rather than pushed positionally, so the
 * order lives in exactly one place — `statusBarItems()`.
 */
const STAT_FORMATTERS: Record<StatusBarStatId, (s: FullVaultMetrics) => string> = {
	'notes': s => new DecimalUnitFormatter(t().statusBar.notes).format(s.notes),
	'words': s => new DecimalUnitFormatter(t().statusBar.words).format(s.words),
	'links': s => new DecimalUnitFormatter(t().statusBar.links).format(s.links),
	'tags': s => new DecimalUnitFormatter(t().statusBar.tags).format(s.tags),
	'QoV': s => new DecimalUnitFormatter(t().statusBar.QoV).format(s.quality),
	'own': s => new DecimalUnitFormatter(t().statusBar.own).format(s.ownNotes),
	'source': s => new DecimalUnitFormatter(t().statusBar.source).format(s.sourceNotes),
	'own-pct': s => `${percentString(s.ownPct())} ${t().statusBar.ownPct}`,
	'source-pct': s => `${percentString(s.sourcePct())} ${t().statusBar.sourcePct}`,
	'concepts': s => new DecimalUnitFormatter(t().statusBar.concepts).format(s.conceptNotes),
	'orphans': s => new DecimalUnitFormatter(t().statusBar.orphans).format(s.orphanNotes),
	'trace-pct': s => `${percentString(s.tracePct())} ${t().statusBar.tracePct}`,
};

class FullStatisticsStatusBarItem {

	private owner: FullStatisticsPlugin;

	// handle of the status bar item to draw into.
	private statusBarItem: HTMLElement;

	// raw stats
	private vaultMetrics!: FullVaultMetrics;

	// index of the currently displayed stat.
	private displayedStatisticIndex = 0;

	private statisticViews: Array<StatisticView> = [];

	constructor(owner: FullStatisticsPlugin, statusBarItem: HTMLElement) {
		this.owner = owner;
		this.statusBarItem = statusBarItem;

		// Built from the same array the settings tab renders, so the views and
		// their toggles cannot drift out of order. The id tags the element with
		// a stable CSS class; the label is read inside the formatter, on every
		// refresh, so it follows the interface language.
		for (const item of statusBarItems()) {
			this.statisticViews.push(new StatisticView(this.statusBarItem)
				.setStatisticId(item.id)
				.setFormatter(STAT_FORMATTERS[item.id]));
		}

		this.statusBarItem.onClickEvent(() => { this.onclick() });
	}

	public setFullVaultMetrics(vaultMetrics: FullVaultMetrics) {
		this.vaultMetrics = vaultMetrics;
		this.owner.registerEvent(this.vaultMetrics?.on("updated", this.onUpdated));
		// First refresh runs immediately so the status bar is never blank
		// after startup. Subsequent updates are throttled via refreshSoon.
		this.refresh();
		return this;
	}

	// On every 'updated' event from the collector, refresh through the
	// debounced path — the very first event already painted via the direct
	// refresh() in setFullVaultMetrics, so the user is not staring at a
	// stale status bar for 2 seconds at startup.
	private onUpdated = () => { this.refreshSoon(); };

	private refreshSoon = debounce(() => { this.refresh(); }, 2000, false);

	/**
	 * Positional against `statisticViews` above: both are built from
	 * `statusBarItems()` in the same order, and the settings tab builds its
	 * toggles from that same array, so the three can't drift apart.
	 */
	private viewEnabledFlags(): boolean[] {
		const s = this.owner.settings;
		return statusBarItems().map(item => s[item.key] as boolean);
	}

	public refresh() {
		const enabled = this.viewEnabledFlags();

		if (this.owner.settings.displayIndividualItems) {
			this.statisticViews.forEach((view, i) => {
				view.setActive(enabled[i]).refresh(this.vaultMetrics);
			});
		} else {
			if (!enabled[this.displayedStatisticIndex]) {
				this.advanceToEnabled(enabled);
			}
			this.statisticViews.forEach((view, i) => {
				view.setActive(this.displayedStatisticIndex == i).refresh(this.vaultMetrics);
			});
		}

		this.statusBarItem.title = this.statisticViews.map(view => view.getText()).join("\n");
	}

	private advanceToEnabled(enabled: boolean[]) {
		const n = this.statisticViews.length;
		for (let step = 1; step <= n; step++) {
			const idx = (this.displayedStatisticIndex + step) % n;
			if (enabled[idx]) {
				this.displayedStatisticIndex = idx;
				return;
			}
		}
	}

	private onclick() {
		if (!this.owner.settings.displayIndividualItems) {
			this.advanceToEnabled(this.viewEnabledFlags());
		}
		this.refresh();
	}
}

