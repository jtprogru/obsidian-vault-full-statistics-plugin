import { App, PluginSettingTab } from "obsidian";
import type {
	ExtraButtonComponent,
	Setting,
	SettingDefinition,
	SettingDefinitionItem,
	SettingDefinitionList,
	SettingDefinitionPage,
} from "obsidian";

import StatisticsPlugin from "./main";
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

	getSettingDefinitions(): SettingDefinitionItem<SettingsKey>[] {
		return [
			{
				name: "Show individual items",
				desc: "Whether to show multiple items at once or cycle them with a click",
				control: { type: 'toggle', key: 'displayIndividualItems', defaultValue: DEFAULT_SETTINGS.displayIndividualItems },
			},
			{
				type: 'group',
				heading: "Status bar items",
				// Cycling mode shows one statistic at a time, so the
				// per-item toggles only mean something when every item is
				// rendered at once.
				visible: () => this.plugin.settings.displayIndividualItems,
				items: [
					this.toggle("Show notes", 'showNotes'),
					this.toggle("Show words", 'showWords', "Total word count across the vault."),
					this.toggle("Show links", 'showLinks'),
					this.toggle("Show tags", 'showTags'),
					this.toggle("Show quality", 'showQuality'),
					this.toggle("Show own notes", 'showOwn', "Notes tagged as your own thinking (own taxonomy below)."),
					this.toggle("Show source notes", 'showSource', "Notes about external material (source taxonomy below)."),
					this.toggle("Show own %", 'showOwnPct', "Share of own notes within own+source classified set."),
					this.toggle("Show source %", 'showSourcePct'),
					this.toggle("Show concept notes", 'showConcepts', "Concepts are a grey zone — off by default."),
					this.toggle("Show orphans", 'showOrphans', "Notes with no incoming links — disconnected knowledge."),
					this.toggle("Show trace %", 'showTracePct', "Share of source notes that at least one own note links to."),
				],
			},
			{
				type: 'group',
				heading: "Metrics section",
				items: [
					this.toggle("Links", 'metricsShowLinks'),
					this.toggle("Tags", 'metricsShowTags'),
					this.toggle("Concepts", 'metricsShowConcepts'),
					this.toggle("Orphans", 'metricsShowOrphans'),
					this.toggle("Avg words", 'metricsShowAvgWords'),
				],
			},

			...this.stringList({
				name: "Excluded folders",
				desc: "Folders to skip from statistics.",
				placeholder: "e.g. Templates",
				addLabel: "Add folder",
				pick: 'folder',
				get: () => this.plugin.settings.excludedFolders,
				set: (items) => { this.plugin.settings.excludedFolders = items; },
				affectsCollector: true,
			}),
			...this.stringList({
				name: "Own tags",
				desc: "Tags marking your own thinking. Leading # is optional.",
				placeholder: "e.g. thought",
				addLabel: "Add tag",
				get: () => this.plugin.settings.ownTags,
				set: (items) => { this.plugin.settings.ownTags = items; },
				affectsCollector: true,
			}),
			...this.stringList({
				name: "Source tags",
				desc: "Tags marking notes about external material.",
				placeholder: "e.g. book",
				addLabel: "Add tag",
				get: () => this.plugin.settings.sourceTags,
				set: (items) => { this.plugin.settings.sourceTags = items; },
				affectsCollector: true,
			}),
			...this.stringList({
				name: "Concept tags",
				desc: "Tags marking concept notes (the grey zone).",
				placeholder: "e.g. concept",
				addLabel: "Add tag",
				get: () => this.plugin.settings.conceptTags,
				set: (items) => { this.plugin.settings.conceptTags = items; },
				affectsCollector: true,
			}),

			{
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
					this.toggle("Show folder breakdown", 'showFolderBreakdown', "Per-folder section in the statistics view (PARA-style)."),
					...this.folderGroups(),
				],
			},

			{
				type: 'group',
				heading: "Sources with trace",
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
					),
				],
			},

			{
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
			},

			{
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
			},

			{
				type: 'group',
				heading: "History",
				items: [
					this.toggle(
						"Show history",
						'showHistory',
						"30-day sparkline section in the statistics view. Snapshots are recorded daily regardless of this toggle.",
					),
					{
						name: "History export folder",
						desc: "Last folder used for CSV export. The export command opens a folder picker each time and updates this value.",
						control: {
							type: 'folder',
							key: 'historyExportFolder',
							defaultValue: DEFAULT_SETTINGS.historyExportFolder,
							placeholder: "(vault root)",
							includeRoot: true,
						},
					},
				],
			},

			this.tangles(),
		];
	}

	/** Boolean row bound straight to a settings key. */
	private toggle(name: string, key: SettingsKey, desc?: string): SettingDefinition<SettingsKey> {
		return {
			name,
			desc,
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

		return [{ name: opts.name, desc: opts.desc }, list];
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
