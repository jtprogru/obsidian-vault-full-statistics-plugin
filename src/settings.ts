import { App, Notice, PluginSettingTab } from "obsidian";
import type {
	ExtraButtonComponent,
	Setting,
	SettingDefinition,
	SettingDefinitionGroup,
	SettingDefinitionItem,
	SettingDefinitionList,
	SettingDefinitionPage,
} from "obsidian";

import type StatisticsPlugin from "./main";
import { setLocale, t, type LanguageSetting } from "./i18n";
import { FolderPickerModal, NoteFuzzyPickerModal } from "./pickers";

export interface FolderGroup {
	name: string;
	paths: string[];
}

export interface FullStatisticsPluginSettings {
	/**
	 * Interface language. `'auto'` follows Obsidian; the default is `'en'` so
	 * that updating the plugin never switches someone's interface for them.
	 */
	language: LanguageSetting,
	/**
	 * Keep the three hero tiles in English even when the interface is not.
	 * The Russian forms are wider and «12,35 тыс.» is wider still than
	 * `12.35K`; on a narrow sidebar that can overflow.
	 */
	heroLabelsInEnglish: boolean,
	displayIndividualItems: boolean,
	showNotes: boolean,
	showWords: boolean,
	showLinks: boolean,
	showTags: boolean,
	showQuality: boolean,
	showOwn: boolean,
	showSource: boolean,
	showOwnPct: boolean,
	showSourcePct: boolean,
	showConcepts: boolean,
	showOrphans: boolean,
	showTracePct: boolean,
	showSourcesTrace: boolean,
	showDanglingList: boolean,
	excludedFolders: string[],
	ownTags: string[],
	ownFolders: string[],
	sourceTags: string[],
	sourceFolders: string[],
	conceptTags: string[],
	conceptFolders: string[],
	folderGroups: FolderGroup[],
	showFolderBreakdown: boolean,
	historyExportFolder: string,
	canonicalTags: string[],
	rareTagThreshold: number,
	showTaxonomyDrift: boolean,
	showHistory: boolean,
	showInbox: boolean,
	inboxFolders: string[],
	inboxReviewTags: string[],
	metricsShowLinks: boolean,
	metricsShowTags: boolean,
	metricsShowConcepts: boolean,
	metricsShowOrphans: boolean,
	metricsShowAvgWords: boolean,
	tanglesMode: 'and' | 'or' | 'sum',
	tanglesMinIn: number,
	tanglesMinOut: number,
	tanglesMinTotal: number,
	tanglesTopN: number,
	tanglesReportFolder: string,
	tanglesExclude: string[],
}

/**
 * Every settings key, used to bind declarative controls. Typing the
 * definitions with this makes a typo in a `key` a compile error rather
 * than a silently dead control.
 */
export type SettingsKey = keyof FullStatisticsPluginSettings;

/**
 * Defaults live next to the interface so the declarative definitions can
 * reference them for `defaultValue` without importing from main.ts (which
 * imports this module back).
 */
export const DEFAULT_SETTINGS: FullStatisticsPluginSettings = {
	language: 'en',
	heroLabelsInEnglish: false,
	displayIndividualItems: false,
	showNotes: true,
	showWords: true,
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
	showSourcesTrace: false,
	showDanglingList: true,
	excludedFolders: [],
	ownTags: ["thought", "synthesis", "fleeting"],
	ownFolders: [],
	sourceTags: ["book", "article", "video", "lecture", "literature", "literature-note"],
	sourceFolders: [],
	conceptTags: ["concept"],
	conceptFolders: [],
	folderGroups: [],
	showFolderBreakdown: false,
	historyExportFolder: '',
	canonicalTags: [],
	rareTagThreshold: 3,
	showTaxonomyDrift: false,
	showHistory: false,
	showInbox: false,
	inboxFolders: [],
	inboxReviewTags: ["inbox/review"],
	metricsShowLinks: true,
	metricsShowTags: true,
	metricsShowConcepts: true,
	metricsShowOrphans: true,
	metricsShowAvgWords: true,
	tanglesMode: 'and',
	tanglesMinIn: 5,
	tanglesMinOut: 5,
	tanglesMinTotal: 10,
	tanglesTopN: 25,
	tanglesReportFolder: '',
	tanglesExclude: [],
};

/**
 * Settings whose value feeds the metrics collector. Changing one of these
 * has to push the new value into the running collector and rescan, not
 * just persist.
 */
const COLLECTOR_KEYS: ReadonlySet<string> = new Set<SettingsKey>([
	"excludedFolders",
	"ownTags",
	"ownFolders",
	"sourceTags",
	"sourceFolders",
	"conceptTags",
	"conceptFolders",
	"inboxFolders",
	"inboxReviewTags",
]);

/**
 * A togglable statistic.
 *
 * `id` and `name` are deliberately separate. The id is a stable English
 * identifier that reaches the user as a CSS class
 * (`obsidian-vault-full-statistics--item-notes`) and must never change —
 * people write snippets against those classes. The name is a label and
 * changes with the interface language.
 */
interface ToggleItem {
	id: StatusBarStatId;
	key: SettingsKey;
	name: string;
	desc?: string;
	aliases?: string[];
}

/** Ids of the status bar statistics, in render order. Part of the CSS surface. */
export type StatusBarStatId =
	| 'notes' | 'words' | 'links' | 'tags' | 'QoV'
	| 'own' | 'source' | 'own-pct' | 'source-pct'
	| 'concepts' | 'orphans' | 'trace-pct';

/**
 * The status bar statistics, in the order the status bar renders them —
 * `StatusBarView` builds its views and reads its enabled-flags in exactly
 * this sequence. One source of truth for the toggle rows and the "N of 12"
 * summary on the page entry.
 *
 * A function rather than a constant: labels come from the active locale, and a
 * module-level constant would freeze on whichever locale was active at import
 * time.
 */
export function statusBarItems(): readonly ToggleItem[] {
	const l = t().settings.statusBar;
	return [
		{ id: 'notes', key: 'showNotes', name: l.notes },
		{ id: 'words', key: 'showWords', name: l.words, desc: l.wordsDesc },
		{ id: 'links', key: 'showLinks', name: l.links },
		{ id: 'tags', key: 'showTags', name: l.tags },
		{ id: 'QoV', key: 'showQuality', name: l.quality, aliases: l.qualityAliases },
		{ id: 'own', key: 'showOwn', name: l.own, desc: l.ownDesc },
		{ id: 'source', key: 'showSource', name: l.source, desc: l.sourceDesc },
		{ id: 'own-pct', key: 'showOwnPct', name: l.ownPct, desc: l.ownPctDesc },
		{ id: 'source-pct', key: 'showSourcePct', name: l.sourcePct },
		{ id: 'concepts', key: 'showConcepts', name: l.concepts, desc: l.conceptsDesc },
		{ id: 'orphans', key: 'showOrphans', name: l.orphans, desc: l.orphansDesc, aliases: l.orphansAliases },
		{ id: 'trace-pct', key: 'showTracePct', name: l.tracePct, desc: l.tracePctDesc },
	];
}

/** Secondary metrics in the side view's grid, below the hero panel. */
function metricsItems(): readonly Omit<ToggleItem, 'id'>[] {
	const l = t().settings.metrics;
	return [
		{ key: 'metricsShowLinks', name: l.links },
		{ key: 'metricsShowTags', name: l.tags },
		{ key: 'metricsShowConcepts', name: l.concepts },
		{ key: 'metricsShowOrphans', name: l.orphans },
		{ key: 'metricsShowAvgWords', name: l.avgWords },
	];
}

export function parseFolderGroups(text: string): FolderGroup[] {
	const groups: FolderGroup[] = [];
	for (const rawLine of text.split("\n")) {
		const line = rawLine.trim();
		if (line.length === 0 || line.startsWith("#")) continue;
		const eqIdx = line.indexOf("=");
		if (eqIdx === -1) continue;
		const name = line.slice(0, eqIdx).trim();
		const paths = line.slice(eqIdx + 1)
			.split(",")
			.map(p => p.trim().replace(/\/+$/, ""))
			.filter(p => p.length > 0);
		if (name.length === 0 || paths.length === 0) continue;
		groups.push({ name, paths });
	}
	return groups;
}

export function serializeFolderGroups(groups: FolderGroup[]): string {
	return groups.map(g => `${g.name} = ${g.paths.join(", ")}`).join("\n");
}


/** Options for {@link FullStatisticsPluginSettingTab.stringList}. */
interface StringListOptions {
	name: string;
	desc: string;
	placeholder: string;
	addLabel: string;
	get: () => string[];
	set: (items: string[]) => void;
	/**
	 * Drops the list header. Use on a page whose only content is this list —
	 * the page title already names it, and a header repeating it reads as a
	 * duplicate.
	 */
	standalone?: boolean;
	/** Whether the value feeds the collector and needs a rescan on change. */
	affectsCollector?: boolean;
	/** Opens a picker instead of appending a blank row. */
	pick?: 'folder' | 'note';
	/** Extra "add" affordance in the list header, e.g. a second picker. */
	extraAdd?: { icon: string; tooltip: string; pick: 'folder' | 'note' };
}

export class FullStatisticsPluginSettingTab extends PluginSettingTab {
	plugin: StatisticsPlugin;

	constructor(app: App, plugin: StatisticsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * The inherited implementation reads `plugin.settings` directly, which
	 * happens to be right; overriding keeps the typing honest and pairs
	 * with the {@link setControlValue} override below.
	 */
	getControlValue(key: string): unknown {
		return this.plugin.settings[key as SettingsKey];
	}

	/**
	 * The inherited implementation persists via the plugin's `saveData`,
	 * which would write a bare settings object and drop the history array —
	 * this plugin stores `{settings, history}` together. Route through
	 * `saveSettings()` instead, and re-evaluate `visible` predicates so
	 * dependent rows appear or disappear without a full re-render.
	 */
	async setControlValue(key: string, value: unknown): Promise<void> {
		(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
		// The locale has to change before saveSettings(), which re-fires the
		// metrics event and redraws both panels — otherwise they would repaint
		// in the outgoing language.
		if (key === 'language') setLocale(this.plugin.settings.language);
		await this.plugin.saveSettings();
		if (COLLECTOR_KEYS.has(key)) this.plugin.restartCollector();
		if (key === 'language') {
			// Structural redraw: every name and description on this tab, plus
			// the hero-labels row, which only exists in a non-English UI.
			this.update();
			// Command names and the ribbon tooltip were cached by Obsidian at
			// registration time and cannot be refreshed from here.
			new Notice(t().notices.languageChanged);
			return;
		}
		this.refreshDomState();
	}

	/**
	 * The tab is an index: the first screen carries only the one general
	 * toggle and a list of navigable entries, each summarising its own state.
	 * Everything else lives one level down.
	 */
	getSettingDefinitions(): SettingDefinitionItem<SettingsKey>[] {
		return [
			...this.general(),
			this.counting(),
			this.sideView(),
			this.tools(),
		];
	}

	/**
	 * The leading section carries no heading: the tab title in the sidebar
	 * already names the plugin, and headings only start to earn their keep
	 * from the second section onwards.
	 */
	private general(): SettingDefinitionItem<SettingsKey>[] {
		const enabled = () => statusBarItems().filter(i => this.plugin.settings[i.key]).length;
		return [
			{
				name: t().settings.language.name,
				// English is the default on purpose: updating the plugin should
				// not switch the interface of someone who never asked for it.
				// Following Obsidian is one click away for those who want it.
				desc: t().settings.language.desc,
				control: {
					type: 'dropdown',
					key: 'language',
					defaultValue: DEFAULT_SETTINGS.language,
					options: {
						en: t().settings.language.english,
						ru: t().settings.language.russian,
						auto: t().settings.language.auto,
					},
				},
			},
			{
				name: t().settings.individualItems.name,
				desc: t().settings.individualItems.desc,
				control: { type: 'toggle', key: 'displayIndividualItems', defaultValue: DEFAULT_SETTINGS.displayIndividualItems },
			},
			{
				type: 'page',
				name: t().settings.statusBar.name,
				// These apply in both modes: cycling walks only the enabled
				// items and skips over the rest.
				desc: t().settings.statusBar.desc,
				displayValue: () => t().settings.ofTotal(enabled(), statusBarItems().length),
				// Nothing enabled leaves the status bar blank in either mode.
				status: () => enabled() === 0 ? 'warning' : null,
				items: statusBarItems().map(i => this.toggle(i.name, i.key, i.desc, i.aliases)),
			},
		];
	}

	/** What the collector sees: the folders it skips and the tags it sorts by. */
	private counting(): SettingDefinitionGroup<SettingsKey> {
		const s = () => this.plugin.settings;
		return {
			type: 'group',
			heading: t().settings.counting.heading,
			items: [
				{
					type: 'page',
					name: t().settings.counting.excludedName,
					desc: t().settings.counting.excludedDesc,
					displayValue: () => t().settings.folderCount(s().excludedFolders.length),
					items: [this.stringList({
						name: t().settings.counting.excludedName,
						desc: t().settings.counting.excludedListDesc,
						standalone: true,
						placeholder: t().settings.counting.excludedPlaceholder,
						addLabel: t().settings.addFolder,
						pick: 'folder',
						get: () => s().excludedFolders,
						set: (items) => { s().excludedFolders = items; },
						affectsCollector: true,
					})],
				},
				{
					type: 'page',
					name: t().settings.counting.classificationName,
					desc: t().settings.counting.classificationDesc,
					displayValue: () => t().settings.counting.classificationValue(s().ownTags.length, s().sourceTags.length),
					// Own/source is the headline metric of the whole plugin;
					// an empty side leaves the hero panel meaningless.
					status: () => s().ownTags.length === 0 || s().sourceTags.length === 0 ? 'warning' : null,
					items: [
						this.stringList({
							name: t().settings.counting.ownTags,
							desc: t().settings.counting.ownTagsDesc,
							placeholder: t().settings.counting.ownTagsPlaceholder,
							addLabel: t().settings.addTag,
							get: () => s().ownTags,
							set: (items) => { s().ownTags = items; },
							affectsCollector: true,
						}),
						this.stringList({
							name: t().settings.counting.ownFolders,
							desc: t().settings.counting.ownFoldersDesc,
							placeholder: t().settings.counting.ownFoldersPlaceholder,
							addLabel: t().settings.addFolder,
							pick: 'folder',
							get: () => s().ownFolders,
							set: (items) => { s().ownFolders = items; },
							affectsCollector: true,
						}),
						this.stringList({
							name: t().settings.counting.sourceTags,
							desc: t().settings.counting.sourceTagsDesc,
							placeholder: t().settings.counting.sourceTagsPlaceholder,
							addLabel: t().settings.addTag,
							get: () => s().sourceTags,
							set: (items) => { s().sourceTags = items; },
							affectsCollector: true,
						}),
						this.stringList({
							name: t().settings.counting.sourceFolders,
							desc: t().settings.counting.sourceFoldersDesc,
							placeholder: t().settings.counting.sourceFoldersPlaceholder,
							addLabel: t().settings.addFolder,
							pick: 'folder',
							get: () => s().sourceFolders,
							set: (items) => { s().sourceFolders = items; },
							affectsCollector: true,
						}),
						this.stringList({
							name: t().settings.counting.conceptTags,
							desc: t().settings.counting.conceptTagsDesc,
							placeholder: t().settings.counting.conceptTagsPlaceholder,
							addLabel: t().settings.addTag,
							get: () => s().conceptTags,
							set: (items) => { s().conceptTags = items; },
							affectsCollector: true,
						}),
						this.stringList({
							name: t().settings.counting.conceptFolders,
							desc: t().settings.counting.conceptFoldersDesc,
							placeholder: t().settings.counting.conceptFoldersPlaceholder,
							addLabel: t().settings.addFolder,
							pick: 'folder',
							get: () => s().conceptFolders,
							set: (items) => { s().conceptFolders = items; },
							affectsCollector: true,
						}),
					],
				},
			],
		};
	}

	/**
	 * Every optional section of the statistics view, one entry each. Two of
	 * them hold only a pair of toggles, but a section that looks like its
	 * neighbours is worth more here than a row saved: the alternative is an
	 * index with loose toggles wedged between navigable entries, and the API
	 * does not let a group nest inside another group.
	 */
	private sideView(): SettingDefinitionGroup<SettingsKey> {
		return {
			type: 'group',
			heading: t().settings.sideViewHeading,
			items: [
				{
					...this.toggle(
						t().settings.heroLabels.name,
						'heroLabelsInEnglish',
						t().settings.heroLabels.desc,
						t().settings.heroLabels.aliases,
					),
					// Pointless while the interface is already English.
					visible: () => this.plugin.settings.language !== 'en',
				},
				this.metrics(),
				this.folderBreakdown(),
				this.sourcesTrace(),
				this.taxonomyDrift(),
				this.inboxHealth(),
				this.history(),
			],
		};
	}

	private tools(): SettingDefinitionGroup<SettingsKey> {
		return {
			type: 'group',
			heading: t().settings.toolsHeading,
			items: [this.tangles()],
		};
	}

	private metrics(): SettingDefinitionPage<SettingsKey> {
		const enabled = () => metricsItems().filter(i => this.plugin.settings[i.key]).length;
		return {
			type: 'page',
			name: t().settings.metrics.name,
			desc: t().settings.metrics.desc,
			displayValue: () => t().settings.ofTotal(enabled(), metricsItems().length),
			items: metricsItems().map(i => this.toggle(i.name, i.key, i.desc, i.aliases)),
		};
	}

	private folderBreakdown(): SettingDefinitionPage<SettingsKey> {
		return {
			type: 'page',
			name: t().settings.folderBreakdown.name,
			desc: t().settings.folderBreakdown.desc,
			displayValue: () => this.plugin.settings.showFolderBreakdown
				? t().settings.groupCount(this.plugin.settings.folderGroups.length)
				: t().settings.off,
			// The section renders nothing without groups, so an enabled
			// toggle and an empty list is a silent no-op worth flagging.
			status: () => this.plugin.settings.showFolderBreakdown
				&& this.plugin.settings.folderGroups.length === 0 ? 'warning' : null,
			items: [
				this.toggle(t().settings.folderBreakdown.name, 'showFolderBreakdown', t().settings.folderBreakdown.desc, t().settings.folderBreakdown.toggleAliases),
				this.folderGroups(),
			],
		};
	}

	private sourcesTrace(): SettingDefinitionPage<SettingsKey> {
		const s = () => this.plugin.settings;
		return {
			type: 'page',
			name: t().settings.sourcesTrace.name,
			desc: t().settings.sourcesTrace.desc,
			displayValue: () => !s().showSourcesTrace
				? t().settings.off
				: s().showDanglingList ? t().settings.sourcesTrace.onTop5 : t().settings.on,
			items: [
				this.toggle(
					t().settings.sourcesTrace.toggleName,
					'showSourcesTrace',
					t().settings.sourcesTrace.toggleDesc,
				),
				this.toggle(
					t().settings.sourcesTrace.danglingName,
					'showDanglingList',
					t().settings.sourcesTrace.danglingDesc,
					t().settings.sourcesTrace.danglingAliases,
				),
			],
		};
	}

	private taxonomyDrift(): SettingDefinitionPage<SettingsKey> {
		return {
			type: 'page',
			name: t().settings.taxonomy.name,
			desc: t().settings.taxonomy.desc,
			displayValue: () => this.plugin.settings.showTaxonomyDrift
				? t().settings.canonicalTagCount(this.plugin.settings.canonicalTags.length)
				: t().settings.off,
			// With no canonical set every tag reads as unknown, which
			// makes the section noise rather than signal.
			status: () => this.plugin.settings.showTaxonomyDrift
				&& this.plugin.settings.canonicalTags.length === 0 ? 'warning' : null,
			items: [
				this.toggle(
					t().settings.taxonomy.toggleName,
					'showTaxonomyDrift',
					t().settings.taxonomy.toggleDesc,
				),
				{
					name: t().settings.taxonomy.thresholdName,
					desc: t().settings.taxonomy.thresholdDesc,
					control: {
						type: 'number',
						key: 'rareTagThreshold',
						defaultValue: DEFAULT_SETTINGS.rareTagThreshold,
						placeholder: String(DEFAULT_SETTINGS.rareTagThreshold),
						min: 1,
						step: 1,
						validate: (value) => Number.isInteger(value) && value >= 1
							? undefined
							: t().settings.taxonomy.thresholdInvalid,
					},
				},
				this.stringList({
					name: t().settings.taxonomy.canonicalName,
					desc: t().settings.taxonomy.canonicalDesc,
					placeholder: t().settings.taxonomy.canonicalPlaceholder,
					addLabel: t().settings.addTag,
					get: () => this.plugin.settings.canonicalTags,
					set: (items) => { this.plugin.settings.canonicalTags = items; },
				}),
			],
		};
	}

	private inboxHealth(): SettingDefinitionPage<SettingsKey> {
		return {
			type: 'page',
			name: t().settings.inbox.name,
			desc: t().settings.inbox.desc,
			displayValue: () => this.plugin.settings.showInbox
				? t().settings.folderCount(this.plugin.settings.inboxFolders.length)
				: t().settings.off,
			// Neither folders nor review tags means nothing is ever
			// collected — the section stays empty and copy refuses.
			status: () => this.plugin.settings.showInbox
				&& this.plugin.settings.inboxFolders.length === 0
				&& this.plugin.settings.inboxReviewTags.length === 0 ? 'warning' : null,
			items: [
				this.toggle(
					t().settings.inbox.toggleName,
					'showInbox',
					t().settings.inbox.toggleDesc,
				),
				this.stringList({
					name: t().settings.inbox.foldersName,
					desc: t().settings.inbox.foldersDesc,
					placeholder: t().settings.inbox.foldersPlaceholder,
					addLabel: t().settings.addFolder,
					pick: 'folder',
					get: () => this.plugin.settings.inboxFolders,
					set: (items) => { this.plugin.settings.inboxFolders = items; },
					affectsCollector: true,
				}),
				this.stringList({
					name: t().settings.inbox.tagsName,
					desc: t().settings.inbox.tagsDesc,
					placeholder: t().settings.inbox.tagsPlaceholder,
					addLabel: t().settings.addTag,
					get: () => this.plugin.settings.inboxReviewTags,
					set: (items) => { this.plugin.settings.inboxReviewTags = items; },
					affectsCollector: true,
				}),
			],
		};
	}

	private history(): SettingDefinitionPage<SettingsKey> {
		return {
			type: 'page',
			name: t().settings.history.name,
			desc: t().settings.history.desc,
			displayValue: () => this.plugin.settings.showHistory ? t().settings.on : t().settings.off,
			items: [
				this.toggle(
					t().settings.history.toggleName,
					'showHistory',
					t().settings.history.toggleDesc,
					t().settings.history.toggleAliases,
				),
				{
					name: t().settings.history.exportName,
					desc: t().settings.history.exportDesc,
					aliases: t().settings.history.exportAliases,
					control: {
						type: 'folder',
						key: 'historyExportFolder',
						defaultValue: DEFAULT_SETTINGS.historyExportFolder,
						placeholder: t().settings.vaultRoot,
						includeRoot: true,
					},
				},
			],
		};
	}

	/** Boolean row bound straight to a settings key. */
	private toggle(name: string, key: SettingsKey, desc?: string, aliases?: string[]): SettingDefinition<SettingsKey> {
		return {
			name,
			desc,
			aliases,
			control: { type: 'toggle', key, defaultValue: DEFAULT_SETTINGS[key] as boolean },
		};
	}

	/**
	 * Rows we render ourselves carry no name or description, so the empty
	 * info block would eat half the row and squash the input into the
	 * right-hand control area. Drop it and mark the row so the stylesheet
	 * can let the control take the freed width.
	 */
	private bareRow(setting: Setting): void {
		setting.settingEl.addClass("vfs-settings-row");
		setting.infoEl.remove();
	}

	private tangles(): SettingDefinitionPage<SettingsKey> {
		const isMode = (...modes: FullStatisticsPluginSettings['tanglesMode'][]) =>
			() => modes.includes(this.plugin.settings.tanglesMode);

		return {
			type: 'page',
			name: t().settings.tangles.name,
			desc: t().settings.tangles.desc,
			displayValue: () => {
				const s = this.plugin.settings;
				return s.tanglesMode === 'sum'
					? t().settings.tangles.valueSum(s.tanglesMinTotal)
					: t().settings.tangles.valueAndOr(s.tanglesMode.toUpperCase(), s.tanglesMinIn, s.tanglesMinOut);
			},
			items: [
				{
					name: t().settings.tangles.modeName,
					desc: t().settings.tangles.modeDesc,
					control: {
						type: 'dropdown',
						key: 'tanglesMode',
						defaultValue: DEFAULT_SETTINGS.tanglesMode,
						options: {
							and: t().settings.tangles.modeAnd,
							or: t().settings.tangles.modeOr,
							sum: t().settings.tangles.modeSum,
						},
					},
				},
				{
					name: t().settings.tangles.minInName,
					desc: t().settings.tangles.minInDesc,
					visible: isMode('and', 'or'),
					control: this.countControl('tanglesMinIn'),
				},
				{
					name: t().settings.tangles.minOutName,
					desc: t().settings.tangles.minOutDesc,
					visible: isMode('and', 'or'),
					control: this.countControl('tanglesMinOut'),
				},
				{
					name: t().settings.tangles.minTotalName,
					desc: t().settings.tangles.minTotalDesc,
					visible: isMode('sum'),
					control: this.countControl('tanglesMinTotal'),
				},
				{
					name: t().settings.tangles.topNName,
					desc: t().settings.tangles.topNDesc,
					control: this.countControl('tanglesTopN'),
				},
				{
					name: t().settings.tangles.reportFolderName,
					desc: t().settings.tangles.reportFolderDesc,
					control: {
						type: 'folder',
						key: 'tanglesReportFolder',
						defaultValue: DEFAULT_SETTINGS.tanglesReportFolder,
						placeholder: t().settings.vaultRoot,
						includeRoot: true,
					},
				},
				this.stringList({
					name: t().settings.tangles.excludeName,
					desc: t().settings.tangles.excludeDesc,
					placeholder: t().settings.tangles.excludePlaceholder,
					addLabel: t().settings.tangles.addNote,
					pick: 'note',
					extraAdd: { icon: 'folder-plus', tooltip: t().settings.addFolder, pick: 'folder' },
					get: () => this.plugin.settings.tanglesExclude,
					set: (items) => { this.plugin.settings.tanglesExclude = items; },
				}),
			],
		};
	}

	/** Non-negative integer threshold bound to a settings key. */
	private countControl(key: SettingsKey) {
		const fallback = DEFAULT_SETTINGS[key] as number;
		return {
			type: 'number' as const,
			key,
			defaultValue: fallback,
			placeholder: String(fallback),
			min: 0,
			step: 1,
			validate: (value: number) => Number.isInteger(value) && value >= 0
				? undefined
				: t().settings.countInvalid,
		};
	}

	/**
	 * A core-rendered list of entries, named by its own header. The list
	 * supplies delete, drag-to-reorder and the add affordance; each row only
	 * has to render its text input.
	 *
	 * The name lives in `heading` rather than in a preceding labelled row:
	 * the core packs consecutive plain rows into one card, so a label row
	 * ends up joined to whatever sits above it instead of to the list it
	 * names. The header has no slot for the explanation, so that goes to the
	 * empty state — visible exactly while the list is empty, which is when
	 * the user does not yet know what belongs there.
	 *
	 * Entries are array elements, so they cannot bind to a `key` the way
	 * scalar settings do — hence the `render` escape hatch per row.
	 */
	private stringList(opts: StringListOptions): SettingDefinitionList<SettingsKey> {
		const commit = async (items: string[], structural: boolean) => {
			opts.set(items);
			await this.plugin.saveSettings();
			if (opts.affectsCollector) this.plugin.restartCollector();
			// Adding or removing entries changes the shape of the
			// definitions themselves, so a DOM-state refresh is not enough.
			if (structural) this.update();
		};

		const append = (value: string) => {
			const trimmed = value.trim().replace(/\/+$/, "");
			if (!trimmed) return;
			const current = opts.get();
			if (current.includes(trimmed)) return;
			void commit([...current, trimmed], true);
		};

		const openPicker = (kind: 'folder' | 'note') => {
			if (kind === 'note') {
				new NoteFuzzyPickerModal(this.app, (file) => append(file.path), t().settings.pickNote(opts.name)).open();
				return;
			}
			new FolderPickerModal(this.app, (folder) => {
				// The vault root as an exclusion would swallow everything;
				// treat it as a mis-click rather than silently applying it.
				const path = folder.path === '' || folder.path === '/' ? '' : folder.path;
				if (path) append(path);
			}, t().settings.pickFolder(opts.name)).open();
		};

		const list: SettingDefinitionList<SettingsKey> = {
			type: 'list',
			heading: opts.standalone ? undefined : opts.name,
			emptyState: this.listEmptyState(opts.desc, t().settings.listEmpty(opts.addLabel)),
			items: opts.get().map((value, idx) => ({
				name: "",
				searchable: false,
				render: (setting: Setting) => {
					this.bareRow(setting);
					setting.addText((text) => {
						text.setValue(value)
							.setPlaceholder(opts.placeholder)
							.onChange((next) => {
								const arr = [...opts.get()];
								arr[idx] = next.trim();
								void commit(arr, false);
							});
						text.inputEl.classList.add("vfs-input-wide");
					});
				},
			})),
			onDelete: (index: number) => {
				const arr = [...opts.get()];
				arr.splice(index, 1);
				void commit(arr, true);
			},
			onReorder: (oldIndex: number, newIndex: number) => {
				const arr = [...opts.get()];
				const [moved] = arr.splice(oldIndex, 1);
				arr.splice(newIndex, 0, moved);
				void commit(arr, true);
			},
			addItem: {
				name: opts.addLabel,
				action: () => {
					if (opts.pick) {
						openPicker(opts.pick);
						return;
					}
					// Free-text lists get a blank row to type into.
					void commit([...opts.get(), ""], true);
				},
			},
		};

		if (opts.extraAdd) {
			const extra = opts.extraAdd;
			list.extraButtons = [(btn: ExtraButtonComponent) => {
				btn.setIcon(extra.icon)
					.setTooltip(extra.tooltip)
					.onClick(() => openPicker(extra.pick));
			}];
		}

		return list;
	}

	/**
	 * What a list says while it holds nothing: first what belongs in it,
	 * then how to put something there. The core renders this as one muted
	 * line inside the card, so the two sentences run together on purpose.
	 */
	private listEmptyState(desc: string, nudge: string): string {
		return `${desc} ${nudge}`;
	}

	/**
	 * One row per group: [name] = [comma-separated paths]. Multiple paths
	 * inside a group are entered as a comma list in the second input — the
	 * same shape parseFolderGroups already supports. The internal model
	 * stays {name, paths: string[]}; the UI only flattens the paths array
	 * on display and splits it on edit.
	 */
	private folderGroups(): SettingDefinitionList<SettingsKey> {
		const groups = () => this.plugin.settings.folderGroups;

		const commit = async (next: FolderGroup[], structural: boolean) => {
			this.plugin.settings.folderGroups = next;
			await this.plugin.saveSettings();
			if (structural) this.update();
		};

		const list: SettingDefinitionList<SettingsKey> = {
			type: 'list',
			cls: 'vfs-settings-fg',
			heading: t().settings.folderBreakdown.groupsName,
			emptyState: this.listEmptyState(
				t().settings.folderBreakdown.groupsDesc,
				t().settings.folderBreakdown.groupsEmpty,
			),
			items: groups().map((group, gi) => ({
				name: "",
				searchable: false,
				render: (setting: Setting) => { this.renderGroupRow(setting, group, gi); },
			})),
			onDelete: (index: number) => {
				const next = [...groups()];
				next.splice(index, 1);
				void commit(next, true);
			},
			onReorder: (oldIndex: number, newIndex: number) => {
				const next = [...groups()];
				const [moved] = next.splice(oldIndex, 1);
				next.splice(newIndex, 0, moved);
				void commit(next, true);
			},
			addItem: {
				name: t().settings.folderBreakdown.addGroup,
				action: () => { void commit([...groups(), { name: "", paths: [] }], true); },
			},
		};

		return list;
	}

	private renderGroupRow(setting: Setting, group: FolderGroup, gi: number): void {
		this.bareRow(setting);
		const row = setting.controlEl;
		row.addClass("vfs-settings-fg-row");

		const nameInput = row.createEl("input", {
			cls: "vfs-settings-fg-name",
			type: "text",
			attr: {
				placeholder: t().settings.folderBreakdown.groupNamePlaceholder,
				"aria-label": t().settings.folderBreakdown.groupNameAria,
			},
		});
		nameInput.value = group.name;
		nameInput.addEventListener("change", () => {
			this.plugin.settings.folderGroups[gi].name = nameInput.value.trim();
			void this.plugin.saveSettings();
		});

		row.createSpan({ cls: "vfs-settings-fg-eq", text: "=" });

		const pathsInput = row.createEl("input", {
			cls: "vfs-settings-fg-path-input",
			type: "text",
			attr: {
				placeholder: t().settings.folderBreakdown.groupPathsPlaceholder,
				"aria-label": t().settings.folderBreakdown.groupPathsAria,
			},
		});
		pathsInput.value = group.paths.join(", ");
		pathsInput.addEventListener("change", () => {
			this.plugin.settings.folderGroups[gi].paths = pathsInput.value
				.split(",")
				.map(p => p.trim().replace(/\/+$/, ""))
				.filter(p => p.length > 0);
			void this.plugin.saveSettings();
		});
	}
}
