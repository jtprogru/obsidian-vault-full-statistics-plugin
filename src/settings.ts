import { App, PluginSettingTab } from "obsidian";
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
import { FolderPickerModal, NoteFuzzyPickerModal } from "./pickers";

export interface FolderGroup {
	name: string;
	paths: string[];
}

export interface FullStatisticsPluginSettings {
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
	sourceTags: string[],
	conceptTags: string[],
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
	sourceTags: ["book", "article", "video", "lecture", "literature", "literature-note"],
	conceptTags: ["concept"],
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
	"sourceTags",
	"conceptTags",
	"inboxFolders",
	"inboxReviewTags",
]);

/** A togglable item: the row it renders and the settings key behind it. */
interface ToggleItem {
	key: SettingsKey;
	name: string;
	desc?: string;
	aliases?: string[];
}

/**
 * The status bar statistics, in the order the status bar renders them —
 * `StatusBarView` builds its views and reads its enabled-flags in exactly
 * this sequence. One source of truth for the toggle rows and the "N of 12"
 * summary on the page entry.
 */
export const STATUS_BAR_ITEMS: readonly ToggleItem[] = [
	{ key: 'showNotes', name: "Show notes" },
	{ key: 'showWords', name: "Show words", desc: "Total word count across the vault." },
	{ key: 'showLinks', name: "Show links" },
	{ key: 'showTags', name: "Show tags" },
	{ key: 'showQuality', name: "Show quality", aliases: ["QoV"] },
	{ key: 'showOwn', name: "Show own notes", desc: "Notes tagged as your own thinking — see note classification." },
	{ key: 'showSource', name: "Show source notes", desc: "Notes about external material — see note classification." },
	{ key: 'showOwnPct', name: "Show own %", desc: "Share of own notes within own+source classified set." },
	{ key: 'showSourcePct', name: "Show source %" },
	{ key: 'showConcepts', name: "Show concept notes", desc: "Concepts are a grey zone — off by default." },
	{ key: 'showOrphans', name: "Show orphans", desc: "Notes with no incoming links — disconnected knowledge.", aliases: ["disconnected"] },
	{ key: 'showTracePct', name: "Show trace %", desc: "Share of source notes that at least one own note links to." },
];

/** Secondary metrics in the side view's grid, below the hero panel. */
const METRICS_ITEMS: readonly ToggleItem[] = [
	{ key: 'metricsShowLinks', name: "Links" },
	{ key: 'metricsShowTags', name: "Tags" },
	{ key: 'metricsShowConcepts', name: "Concepts" },
	{ key: 'metricsShowOrphans', name: "Orphans" },
	{ key: 'metricsShowAvgWords', name: "Avg words" },
];

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

/** "3 groups" / "1 group" / "No groups" — for a page's inline display value. */
export function count(n: number, noun: string): string {
	if (n === 0) return `No ${noun}s`;
	return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/** Options for {@link FullStatisticsPluginSettingTab.stringList}. */
interface StringListOptions {
	name: string;
	desc: string;
	placeholder: string;
	addLabel: string;
	get: () => string[];
	set: (items: string[]) => void;
	/** Extra search terms for the labelled row. */
	aliases?: string[];
	/**
	 * Drops the labelled row. Use on a page whose only content is this list —
	 * the page title and description already say what the list is, and a row
	 * repeating them reads as a duplicate.
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
		await this.plugin.saveSettings();
		if (COLLECTOR_KEYS.has(key)) this.plugin.restartCollector();
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
		const enabled = () => STATUS_BAR_ITEMS.filter(i => this.plugin.settings[i.key]).length;
		return [
			{
				name: "Show individual items",
				desc: "Whether to show multiple items at once or cycle them with a click",
				control: { type: 'toggle', key: 'displayIndividualItems', defaultValue: DEFAULT_SETTINGS.displayIndividualItems },
			},
			{
				type: 'page',
				name: "Status bar items",
				// These apply in both modes: cycling walks only the enabled
				// items and skips over the rest.
				desc: "Which statistics the status bar shows. Cycling mode skips the ones turned off here.",
				displayValue: () => `${enabled()} of ${STATUS_BAR_ITEMS.length}`,
				// Nothing enabled leaves the status bar blank in either mode.
				status: () => enabled() === 0 ? 'warning' : null,
				items: STATUS_BAR_ITEMS.map(i => this.toggle(i.name, i.key, i.desc, i.aliases)),
			},
		];
	}

	/** What the collector sees: the folders it skips and the tags it sorts by. */
	private counting(): SettingDefinitionGroup<SettingsKey> {
		const s = () => this.plugin.settings;
		return {
			type: 'group',
			heading: "What gets counted",
			items: [
				{
					type: 'page',
					name: "Excluded folders",
					desc: "Folders to skip from statistics. Matched as a path prefix, so a folder covers everything under it.",
					displayValue: () => count(s().excludedFolders.length, "folder"),
					items: this.stringList({
						name: "Excluded folders",
						desc: "Folders to skip from statistics.",
						aliases: ["ignore", "skip"],
						standalone: true,
						placeholder: "e.g. Templates",
						addLabel: "Add folder",
						pick: 'folder',
						get: () => s().excludedFolders,
						set: (items) => { s().excludedFolders = items; },
						affectsCollector: true,
					}),
				},
				{
					type: 'page',
					name: "Note classification",
					desc: "Tags that sort notes into your own thinking, external material, and concepts.",
					displayValue: () => `${s().ownTags.length} own / ${s().sourceTags.length} source`,
					// Own/source is the headline metric of the whole plugin;
					// an empty side leaves the hero panel meaningless.
					status: () => s().ownTags.length === 0 || s().sourceTags.length === 0 ? 'warning' : null,
					items: [
						...this.stringList({
							name: "Own tags",
							desc: "Tags marking your own thinking. Leading # is optional.",
							aliases: ["classification", "zettelkasten"],
							placeholder: "e.g. thought",
							addLabel: "Add tag",
							get: () => s().ownTags,
							set: (items) => { s().ownTags = items; },
							affectsCollector: true,
						}),
						...this.stringList({
							name: "Source tags",
							desc: "Tags marking notes about external material.",
							aliases: ["classification", "literature"],
							placeholder: "e.g. book",
							addLabel: "Add tag",
							get: () => s().sourceTags,
							set: (items) => { s().sourceTags = items; },
							affectsCollector: true,
						}),
						...this.stringList({
							name: "Concept tags",
							desc: "Tags marking concept notes (the grey zone).",
							aliases: ["classification"],
							placeholder: "e.g. concept",
							addLabel: "Add tag",
							get: () => s().conceptTags,
							set: (items) => { s().conceptTags = items; },
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
			heading: "Side view",
			items: [
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
			heading: "Tools",
			items: [this.tangles()],
		};
	}

	private metrics(): SettingDefinitionPage<SettingsKey> {
		const enabled = () => METRICS_ITEMS.filter(i => this.plugin.settings[i.key]).length;
		return {
			type: 'page',
			name: "Metrics",
			desc: "Secondary metrics in the grid below the hero panel.",
			displayValue: () => `${enabled()} of ${METRICS_ITEMS.length}`,
			items: METRICS_ITEMS.map(i => this.toggle(i.name, i.key, i.desc, i.aliases)),
		};
	}

	private folderBreakdown(): SettingDefinitionPage<SettingsKey> {
		return {
			type: 'page',
			name: "Folder breakdown",
			desc: "Per-folder section in the statistics view (PARA-style).",
			displayValue: () => this.plugin.settings.showFolderBreakdown
				? count(this.plugin.settings.folderGroups.length, "group")
				: "Off",
			// The section renders nothing without groups, so an enabled
			// toggle and an empty list is a silent no-op worth flagging.
			status: () => this.plugin.settings.showFolderBreakdown
				&& this.plugin.settings.folderGroups.length === 0 ? 'warning' : null,
			items: [
				this.toggle("Show folder breakdown", 'showFolderBreakdown', "Per-folder section in the statistics view (PARA-style).", ["PARA"]),
				...this.folderGroups(),
			],
		};
	}

	private sourcesTrace(): SettingDefinitionPage<SettingsKey> {
		const s = () => this.plugin.settings;
		return {
			type: 'page',
			name: "Sources with trace",
			desc: "How many source notes are referenced by at least one own note.",
			displayValue: () => !s().showSourcesTrace
				? "Off"
				: s().showDanglingList ? "On + top 5" : "On",
			items: [
				this.toggle(
					"Show sources-with-trace",
					'showSourcesTrace',
					"Section in the statistics view showing how many source notes are referenced by at least one own note (and which ones aren't).",
				),
				this.toggle(
					"Show dangling notes list",
					'showDanglingList',
					"Inside Sources-with-trace: the top-5 list of source notes nothing links to. Off keeps just the bar and legend.",
					["dangling", "untraced"],
				),
			],
		};
	}

	private taxonomyDrift(): SettingDefinitionPage<SettingsKey> {
		return {
			type: 'page',
			name: "Taxonomy drift",
			desc: "Rare tags and tags outside your canonical set.",
			displayValue: () => this.plugin.settings.showTaxonomyDrift
				? count(this.plugin.settings.canonicalTags.length, "canonical tag")
				: "Off",
			// With no canonical set every tag reads as unknown, which
			// makes the section noise rather than signal.
			status: () => this.plugin.settings.showTaxonomyDrift
				&& this.plugin.settings.canonicalTags.length === 0 ? 'warning' : null,
			items: [
				this.toggle(
					"Show taxonomy drift",
					'showTaxonomyDrift',
					"Section in the statistics view that lists rare tags and tags outside your canonical set.",
				),
				{
					name: "Rare tag threshold",
					desc: "Tags used fewer than this many times are flagged as rare (likely typos or dead).",
					control: {
						type: 'number',
						key: 'rareTagThreshold',
						defaultValue: DEFAULT_SETTINGS.rareTagThreshold,
						placeholder: String(DEFAULT_SETTINGS.rareTagThreshold),
						min: 1,
						step: 1,
						validate: (value) => Number.isInteger(value) && value >= 1
							? undefined
							: "Must be a whole number of 1 or more.",
					},
				},
				...this.stringList({
					name: "Canonical tags",
					desc: "Your accepted tag set. Anything else is flagged as unknown. A canonical parent (e.g. 'journal') covers descendants ('journal/daily').",
					placeholder: "e.g. thought",
					addLabel: "Add tag",
					get: () => this.plugin.settings.canonicalTags,
					set: (items) => { this.plugin.settings.canonicalTags = items; },
				}),
			],
		};
	}

	private inboxHealth(): SettingDefinitionPage<SettingsKey> {
		return {
			type: 'page',
			name: "Inbox health",
			desc: "Notes in inbox folders and notes tagged for review, bucketed by age (<1d / 1–7d / 7–30d / 30+d).",
			displayValue: () => this.plugin.settings.showInbox
				? count(this.plugin.settings.inboxFolders.length, "folder")
				: "Off",
			// Neither folders nor review tags means nothing is ever
			// collected — the section stays empty and copy refuses.
			status: () => this.plugin.settings.showInbox
				&& this.plugin.settings.inboxFolders.length === 0
				&& this.plugin.settings.inboxReviewTags.length === 0 ? 'warning' : null,
			items: [
				this.toggle(
					"Show inbox health",
					'showInbox',
					"Section showing notes in inbox folders and notes outside them tagged with a review tag, bucketed by age (<1d / 1–7d / 7–30d / 30+d).",
				),
				...this.stringList({
					name: "Inbox folders",
					desc: "Folders treated as inbox (techdebt of unprocessed input).",
					placeholder: "e.g. 00. Входящие",
					addLabel: "Add folder",
					pick: 'folder',
					get: () => this.plugin.settings.inboxFolders,
					set: (items) => { this.plugin.settings.inboxFolders = items; },
					affectsCollector: true,
				}),
				...this.stringList({
					name: "Inbox review tags",
					desc: "Tags marking notes that need processing even when outside inbox folders. Leading # is optional.",
					placeholder: "e.g. inbox/review",
					addLabel: "Add tag",
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
			name: "History",
			desc: "30-day sparkline of how the vault evolves.",
			displayValue: () => this.plugin.settings.showHistory ? "On" : "Off",
			items: [
				this.toggle(
					"Show history",
					'showHistory',
					"30-day sparkline section in the statistics view. Snapshots are recorded daily regardless of this toggle.",
					["sparkline"],
				),
				{
					name: "History export folder",
					desc: "Last folder used for CSV export. The export command opens a folder picker each time and updates this value.",
					aliases: ["CSV"],
					control: {
						type: 'folder',
						key: 'historyExportFolder',
						defaultValue: DEFAULT_SETTINGS.historyExportFolder,
						placeholder: "(vault root)",
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
			name: "Tangles",
			desc: "Over-connected notes: hubs that link to and are linked from a lot of the vault.",
			displayValue: () => {
				const s = this.plugin.settings;
				return s.tanglesMode === 'sum'
					? `SUM ≥ ${s.tanglesMinTotal}`
					: `${s.tanglesMode.toUpperCase()} ≥ ${s.tanglesMinIn}/${s.tanglesMinOut}`;
			},
			items: [
				{
					name: "Selection mode",
					desc: "AND: both thresholds must be met. OR: either threshold is enough. SUM: in + out must be ≥ total threshold.",
					control: {
						type: 'dropdown',
						key: 'tanglesMode',
						defaultValue: DEFAULT_SETTINGS.tanglesMode,
						options: {
							and: "AND (both ≥ thresholds)",
							or: "OR (either ≥ threshold)",
							sum: "SUM (in + out ≥ total)",
						},
					},
				},
				{
					name: "Min incoming links",
					desc: "Minimum number of distinct notes that link to a tangle.",
					visible: isMode('and', 'or'),
					control: this.countControl('tanglesMinIn'),
				},
				{
					name: "Min outgoing links",
					desc: "Minimum number of distinct notes a tangle links to.",
					visible: isMode('and', 'or'),
					control: this.countControl('tanglesMinOut'),
				},
				{
					name: "Min in + out",
					desc: "Minimum value of (incoming + outgoing) for a note to count as a tangle.",
					visible: isMode('sum'),
					control: this.countControl('tanglesMinTotal'),
				},
				{
					name: "Top N",
					desc: "How many tangles to show in the side view and report. 0 means no limit.",
					control: this.countControl('tanglesTopN'),
				},
				{
					name: "Tangles report folder",
					desc: "Folder in the vault where the tangles report note will be created. Empty = vault root.",
					control: {
						type: 'folder',
						key: 'tanglesReportFolder',
						defaultValue: DEFAULT_SETTINGS.tanglesReportFolder,
						placeholder: "(vault root)",
						includeRoot: true,
					},
				},
				...this.stringList({
				name: "Tangles exclude",
				desc: "Notes or folders to skip in tangle detection. Pick a note to exclude one file, or pick a folder to exclude everything under it. Folder match requires a trailing slash boundary — \"Daily\" does NOT match \"DailyArchive\".",
				placeholder: "e.g. Personal/Me.md",
				addLabel: "Add note",
				pick: 'note',
				extraAdd: { icon: 'folder-plus', tooltip: "Add folder", pick: 'folder' },
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
				: "Must be a whole number of 0 or more.",
		};
	}

	/**
	 * A labelled row carrying the explanation, followed by a core-rendered
	 * list of the entries. The list supplies delete, drag-to-reorder and the
	 * add affordance; each row only has to render its text input.
	 *
	 * Entries are array elements, so they cannot bind to a `key` the way
	 * scalar settings do — hence the `render` escape hatch per row.
	 */
	private stringList(opts: StringListOptions): SettingDefinitionItem<SettingsKey>[] {
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
				new NoteFuzzyPickerModal(this.app, (file) => append(file.path), `Pick a note — ${opts.name}`).open();
				return;
			}
			new FolderPickerModal(this.app, (folder) => {
				// The vault root as an exclusion would swallow everything;
				// treat it as a mis-click rather than silently applying it.
				const path = folder.path === '' || folder.path === '/' ? '' : folder.path;
				if (path) append(path);
			}, `Pick a folder — ${opts.name}`).open();
		};

		const list: SettingDefinitionList<SettingsKey> = {
			type: 'list',
			emptyState: `Nothing yet — use “${opts.addLabel}”.`,
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

		if (opts.standalone) return [list];
		return [{ name: opts.name, desc: opts.desc, aliases: opts.aliases }, list];
	}

	/**
	 * One row per group: [name] = [comma-separated paths]. Multiple paths
	 * inside a group are entered as a comma list in the second input — the
	 * same shape parseFolderGroups already supports. The internal model
	 * stays {name, paths: string[]}; the UI only flattens the paths array
	 * on display and splits it on edit.
	 */
	private folderGroups(): SettingDefinitionItem<SettingsKey>[] {
		const groups = () => this.plugin.settings.folderGroups;

		const commit = async (next: FolderGroup[], structural: boolean) => {
			this.plugin.settings.folderGroups = next;
			await this.plugin.saveSettings();
			if (structural) this.update();
		};

		const list: SettingDefinitionList<SettingsKey> = {
			type: 'list',
			cls: 'vfs-settings-fg',
			emptyState: "No groups yet — add one to get a per-group breakdown.",
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
				name: "Add group",
				action: () => { void commit([...groups(), { name: "", paths: [] }], true); },
			},
		};

		return [
			{
				name: "Folder groups (PARA)",
				desc: 'One row per group. Multiple paths in the same group are comma-separated, e.g. "Areas = 02. Сферы, 02b. Health".',
			},
			list,
		];
	}

	private renderGroupRow(setting: Setting, group: FolderGroup, gi: number): void {
		this.bareRow(setting);
		const row = setting.controlEl;
		row.addClass("vfs-settings-fg-row");

		const nameInput = row.createEl("input", {
			cls: "vfs-settings-fg-name",
			type: "text",
			attr: { placeholder: "Projects", "aria-label": "Group name" },
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
			attr: { placeholder: "01. Проекты, 02. Архив", "aria-label": "Group paths" },
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
