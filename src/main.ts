import { Component, Vault, TFile, Plugin, debounce, MetadataCache, CachedMetadata, TFolder } from 'obsidian';
import { BytesFormatter, DecimalUnitFormatter } from './format';
import { FullVaultMetrics } from './metrics';
import { FullVaultMetricsCollector } from './collect';
import { FullStatisticsPluginSettings, FullStatisticsPluginSettingTab } from './settings';

const DEFAULT_SETTINGS: Partial<FullStatisticsPluginSettings> = {
	displayIndividualItems: false,
	showNotes: false,
	showAttachments: false,
	showFiles: false,
	showLinks: false,
	showWords: false,
	showSize: false,
	showQuality: false,
	showTags: false,
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
			setExcludeDirectories(this.settings.excludeDirectories).
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
	 * Refreshes the content of the view with content from the passed {@link
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

		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("notes").
			setFormatter((s: FullVaultMetrics) => { return new DecimalUnitFormatter("notes").format(s.notes) }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("attachments").
			setFormatter((s: FullVaultMetrics) => { return new DecimalUnitFormatter("attachments").format(s.attachments) }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("files").
			setFormatter((s: FullVaultMetrics) => { return new DecimalUnitFormatter("files").format(s.files) }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("links").
			setFormatter((s: FullVaultMetrics) => { return new DecimalUnitFormatter("links").format(s.links) }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("words").
			setFormatter((s: FullVaultMetrics) => { return new DecimalUnitFormatter("words").format(s.words) }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("size").
			setFormatter((s: FullVaultMetrics) => { return new BytesFormatter().format(s.size) }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("tags").
			setFormatter((s: FullVaultMetrics) => { return new DecimalUnitFormatter("tags").format(s.tags) }));
		this.statisticViews.push(new StatisticView(this.statusBarItem).
			setStatisticName("QoV").
			setFormatter((s: FullVaultMetrics) => { return new DecimalUnitFormatter("QoV").format(s.quality) }));

		this.statusBarItem.onClickEvent(() => { this.onclick() });
	}

	public setFullVaultMetrics(vaultMetrics: FullVaultMetrics) {
		this.vaultMetrics = vaultMetrics;
		this.owner.registerEvent(this.vaultMetrics?.on("updated", this.refreshSoon));
		this.refreshSoon();
		return this;
	}

	private refreshSoon = debounce(() => { this.refresh(); }, 2000, false);

	public refresh() {
		if (this.owner.settings.displayIndividualItems) {
			this.statisticViews[0].setActive(this.owner.settings.showNotes).refresh(this.vaultMetrics);
			this.statisticViews[1].setActive(this.owner.settings.showAttachments).refresh(this.vaultMetrics);
			this.statisticViews[2].setActive(this.owner.settings.showFiles).refresh(this.vaultMetrics);
			this.statisticViews[3].setActive(this.owner.settings.showLinks).refresh(this.vaultMetrics);
			this.statisticViews[4].setActive(this.owner.settings.showWords).refresh(this.vaultMetrics);
			this.statisticViews[5].setActive(this.owner.settings.showSize).refresh(this.vaultMetrics);
			this.statisticViews[6].setActive(this.owner.settings.showTags).refresh(this.vaultMetrics);
			this.statisticViews[7].setActive(this.owner.settings.showQuality).refresh(this.vaultMetrics);
		} else {
			this.statisticViews.forEach((view, i) => {
				view.setActive(this.displayedStatisticIndex == i).refresh(this.vaultMetrics);
			});
		}

		this.statusBarItem.title = this.statisticViews.map(view => view.getText()).join("\n");
	}

	private onclick() {
		if (!this.owner.settings.displayIndividualItems) {
			this.displayedStatisticIndex = (this.displayedStatisticIndex + 1) % this.statisticViews.length;
		}
		this.refresh();
	}
}
