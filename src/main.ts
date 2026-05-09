import { App, Component, Vault, TFile, Plugin, debounce, MetadataCache, CachedMetadata, TFolder, WorkspaceLeaf, Notice, FuzzySuggestModal } from 'obsidian';
import { BytesFormatter, DecimalUnitFormatter } from './format';
import { FullVaultMetrics } from './metrics';
import { FullVaultMetricsCollector } from './collect';
import { FullStatisticsPluginSettings, FullStatisticsPluginSettingTab } from './settings';
import { HistoryStore, Snapshot, snapshotsToCsv } from './historyStore';
import { VaultStatisticsView, VAULT_STATISTICS_VIEW_TYPE } from './statisticsView';


interface PersistedData {
	settings: Partial<FullStatisticsPluginSettings>;
	history: Snapshot[];
}

function isPersistedData(raw: unknown): raw is PersistedData {
	return !!raw && typeof raw === 'object'
		&& 'settings' in (raw as object)
		&& Array.isArray((raw as PersistedData).history);
}

const DEFAULT_SETTINGS: Partial<FullStatisticsPluginSettings> = {
	displayIndividualItems: false,
	showNotes: true,
	showLinks: true,
	showTags: true,
	showQuality: true,
	showOwn: true,
	showSource: true,
	showOwnPct: true,
	showSourcePct: true,
	showConcepts: false,
	showOrphans: true,
	showTracePct: true,
	showSourcesTrace: true,
	excludedFolders: [],
	ownTags: ["thought", "synthesis", "fleeting"],
	sourceTags: ["book", "article", "video", "lecture", "literature", "literature-note"],
	conceptTags: ["concept"],
	folderGroups: [],
	showFolderBreakdown: true,
	historyExportFolder: '',
	canonicalTags: [],
	rareTagThreshold: 3,
	showTaxonomyDrift: true,
};

const HISTORY_CSV_FILENAME = 'Vault Statistics — History.csv';

export default class FullStatisticsPlugin extends Plugin {

	private statusBarItem: FullStatisticsStatusBarItem | null = null;

	public vaultMetricsCollector: FullVaultMetricsCollector;
	public vaultMetrics: FullVaultMetrics;
	public historyStore: HistoryStore;

	settings: FullStatisticsPluginSettings;

	async onload() {
		console.log('Loading vault-statistics Plugin');

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
			start();

		this.statusBarItem = new FullStatisticsStatusBarItem(this, this.addStatusBarItem()).
			setFullVaultMetrics(this.vaultMetrics);

		this.addSettingTab(new FullStatisticsPluginSettingTab(this.app, this));

		// History snapshots: hook the metrics-updated event with a long debounce
		// so we sample after the vault has settled rather than mid-backlog.
		this.registerEvent(this.vaultMetrics.on('updated', this.maybeSnapshot));

		// Orphan count is O(N + L) so we recompute on a debounce instead of
		// inline with every file event. setOrphans is a no-op when the
		// number is unchanged, so this loop is self-quiescent.
		this.registerEvent(this.vaultMetrics.on('updated', this.refreshOrphans));

		// Sources-with-trace is also a graph scan — same debounce pattern.
		this.registerEvent(this.vaultMetrics.on('updated', this.refreshSourcesTrace));

		this.registerView(VAULT_STATISTICS_VIEW_TYPE, (leaf: WorkspaceLeaf) =>
			new VaultStatisticsView(
				leaf,
				this.vaultMetrics,
				this.vaultMetricsCollector,
				this.historyStore,
				() => this.settings,
			));

		this.addCommand({
			id: 'open-vault-statistics-view',
			name: 'Open vault statistics',
			callback: () => this.activateStatisticsView(),
		});

		this.addCommand({
			id: 'export-vault-statistics-history',
			name: 'Export statistics history to CSV',
			callback: () => this.exportHistoryCsv(),
		});

		this.addRibbonIcon('bar-chart', 'Open vault statistics', () => this.activateStatisticsView());
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

		this.settings = Object.assign({}, DEFAULT_SETTINGS, storedSettings) as FullStatisticsPluginSettings;
		this.historyStore = new HistoryStore(storedHistory);
	}

	async saveSettings() {
		await this.persist();
		if (this.statusBarItem) {
			this.statusBarItem.refresh();
		}
		// Re-fire so the sidebar view re-renders after settings (folder
		// groups, taxonomy toggles) change without waiting for the next
		// metrics update.
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
			this.persist();
		}
	}, 10000, false);

	private refreshOrphans = debounce(() => {
		const n = this.vaultMetricsCollector.computeOrphanCount();
		this.vaultMetrics?.setOrphans(n);
	}, 1000, false);

	private refreshSourcesTrace = debounce(() => {
		const { withTrace } = this.vaultMetricsCollector.computeSourcesTrace();
		this.vaultMetrics?.setSourcesWithTrace(withTrace);
	}, 1000, false);

	private async exportHistoryCsv() {
		const snapshots = this.historyStore.all();
		if (snapshots.length === 0) {
			new Notice('No history snapshots yet — try again after a few daily updates.');
			return;
		}
		const csv = snapshotsToCsv(snapshots);

		// Prefer the native OS save dialog (File System Access API) so the
		// user can write anywhere on disk, not just inside the vault.
		// Falls back to the in-vault folder picker on platforms where the
		// API is unavailable (mobile, sandboxed builds).
		const nativePicker = (window as any).showSaveFilePicker;
		if (typeof nativePicker === 'function') {
			try {
				const handle = await nativePicker.call(window, {
					suggestedName: HISTORY_CSV_FILENAME,
					types: [{
						description: 'CSV file',
						accept: { 'text/csv': ['.csv'] },
					}],
				});
				const writable = await handle.createWritable();
				await writable.write(csv);
				await writable.close();
				new Notice(`Exported ${snapshots.length} snapshot(s) to ${handle.name}`);
				return;
			} catch (e: any) {
				if (e?.name === 'AbortError') return; // user cancelled the dialog
				console.error('vault-statistics: native save dialog failed', e);
				// Fall through to in-vault fallback
			}
		}

		new FolderPickerModal(this.app, async (folder) => {
			await this.writeVaultCsv(folder, csv, snapshots.length);
		}).open();
	}

	private async writeVaultCsv(folder: TFolder, csv: string, count: number) {
		const dir = folder.path === '' || folder.path === '/' ? '' : folder.path;
		const path = dir ? `${dir}/${HISTORY_CSV_FILENAME}` : HISTORY_CSV_FILENAME;
		try {
			const existing = this.app.vault.getAbstractFileByPath(path);
			if (existing instanceof TFile) {
				await this.app.vault.modify(existing, csv);
			} else {
				await this.app.vault.create(path, csv);
			}
			this.settings.historyExportFolder = dir;
			await this.persist();
			new Notice(`Exported ${count} snapshot(s) to ${path}`);
		} catch (e) {
			console.error('vault-statistics: csv export failed', e);
			new Notice(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
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
		if (leaf) workspace.revealLeaf(leaf);
	}

	public restartCollector() {
		this.vaultMetricsCollector
			.setExcludedFolders(this.settings.excludedFolders)
			.setOwnTags(this.settings.ownTags)
			.setSourceTags(this.settings.sourceTags)
			.setConceptTags(this.settings.conceptTags)
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
	private formatter: (s: FullVaultMetrics) => string;

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
	 * Sets the name of the statistic.
	 */
	setStatisticName(name: string): StatisticView {
		this.containerElementsForVaultFullStatistics.addClass(`obsidian-vault-full-statistics--item-${name}`);
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

class FullStatisticsStatusBarItem {

	private owner: FullStatisticsPlugin;

	// handle of the status bar item to draw into.
	private statusBarItem: HTMLElement;

	// raw stats
	private vaultMetrics: FullVaultMetrics;

	// index of the currently displayed stat.
	private displayedStatisticIndex = 0;

	private statisticViews: Array<StatisticView> = [];

	constructor(owner: FullStatisticsPlugin, statusBarItem: HTMLElement) {
		this.owner = owner;
		this.statusBarItem = statusBarItem;

		const pctFmt = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 });

		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("notes").
			setFormatter((s: FullVaultMetrics) => { return new DecimalUnitFormatter("notes").format(s.notes) }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("links").
			setFormatter((s: FullVaultMetrics) => { return new DecimalUnitFormatter("links").format(s.links) }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("tags").
			setFormatter((s: FullVaultMetrics) => { return new DecimalUnitFormatter("tags").format(s.tags) }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("QoV").
			setFormatter((s: FullVaultMetrics) => { return new DecimalUnitFormatter("QoV").format(s.quality) }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("own").
			setFormatter((s: FullVaultMetrics) => { return new DecimalUnitFormatter("own").format(s.ownNotes) }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("source").
			setFormatter((s: FullVaultMetrics) => { return new DecimalUnitFormatter("source").format(s.sourceNotes) }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("own-pct").
			setFormatter((s: FullVaultMetrics) => { return `${pctFmt.format(s.ownPct())} own` }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("source-pct").
			setFormatter((s: FullVaultMetrics) => { return `${pctFmt.format(s.sourcePct())} source` }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("concepts").
			setFormatter((s: FullVaultMetrics) => { return new DecimalUnitFormatter("concepts").format(s.conceptNotes) }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("orphans").
			setFormatter((s: FullVaultMetrics) => { return new DecimalUnitFormatter("orphans").format(s.orphanNotes) }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("trace-pct").
			setFormatter((s: FullVaultMetrics) => { return `${pctFmt.format(s.tracePct())} traced` }));

		this.statusBarItem.onClickEvent(() => { this.onclick() });
	}

	public setFullVaultMetrics(vaultMetrics: FullVaultMetrics) {
		this.vaultMetrics = vaultMetrics;
		this.owner.registerEvent(this.vaultMetrics?.on("updated", this.refreshSoon));
		this.refreshSoon();
		return this;
	}

	private refreshSoon = debounce(() => { this.refresh(); }, 2000, false);

	private viewEnabledFlags(): boolean[] {
		const s = this.owner.settings;
		return [
			s.showNotes,
			s.showLinks,
			s.showTags,
			s.showQuality,
			s.showOwn,
			s.showSource,
			s.showOwnPct,
			s.showSourcePct,
			s.showConcepts,
			s.showOrphans,
			s.showTracePct,
		];
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

/**
 * Fuzzy picker over every folder in the vault, including the root.
 * Lets the export command write the CSV anywhere the user wants.
 */
class FolderPickerModal extends FuzzySuggestModal<TFolder> {

	private readonly onSelect: (folder: TFolder) => void;

	constructor(app: App, onSelect: (folder: TFolder) => void) {
		super(app);
		this.onSelect = onSelect;
		this.setPlaceholder('Choose a folder for the CSV');
	}

	getItems(): TFolder[] {
		const out: TFolder[] = [];
		const walk = (folder: TFolder) => {
			out.push(folder);
			for (const child of folder.children) {
				if (child instanceof TFolder) walk(child);
			}
		};
		walk(this.app.vault.getRoot());
		return out;
	}

	getItemText(folder: TFolder): string {
		return folder.path === '' || folder.path === '/'
			? '/ (vault root)'
			: folder.path;
	}

	onChooseItem(folder: TFolder): void {
		this.onSelect(folder);
	}
}
