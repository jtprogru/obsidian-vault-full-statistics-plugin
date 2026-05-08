import { Component, Vault, TFile, Plugin, debounce, MetadataCache, CachedMetadata, TFolder } from 'obsidian';
import { BytesFormatter, DecimalUnitFormatter } from './format';
import { FullVaultMetrics } from './metrics';
import { FullVaultMetricsCollector } from './collect';
import { FullStatisticsPluginSettings, FullStatisticsPluginSettingTab } from './settings';

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
	excludedFolders: [],
	ownTags: ["thought", "synthesis", "fleeting"],
	sourceTags: ["book", "article", "video", "lecture", "literature", "literature-note"],
	conceptTags: ["concept"],
};

export default class FullStatisticsPlugin extends Plugin {

	private statusBarItem: FullStatisticsStatusBarItem | null = null;

	public vaultMetricsCollector: FullVaultMetricsCollector;
	public vaultMetrics: FullVaultMetrics;

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
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		if (this.statusBarItem) {
			this.statusBarItem.refresh();
		}
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
