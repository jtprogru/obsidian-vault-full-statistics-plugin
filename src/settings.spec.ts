import type { SettingDefinitionItem } from 'obsidian';

import {
	count,
	DEFAULT_SETTINGS,
	FullStatisticsPluginSettingTab,
	parseFolderGroups,
	serializeFolderGroups,
} from './settings';
import type { FullStatisticsPluginSettings, SettingsKey } from './settings';

describe("parseFolderGroups", () => {
	test("parses a single group with one path", () => {
		expect(parseFolderGroups("Projects = 01. Проекты")).toEqual([
			{ name: "Projects", paths: ["01. Проекты"] },
		]);
	});

	test("parses multiple groups", () => {
		const text = `Projects = 01. Проекты
Areas = 02. Сферы
Resources = 03. Ресурсы`;
		expect(parseFolderGroups(text)).toEqual([
			{ name: "Projects", paths: ["01. Проекты"] },
			{ name: "Areas", paths: ["02. Сферы"] },
			{ name: "Resources", paths: ["03. Ресурсы"] },
		]);
	});

	test("parses comma-separated paths within a group", () => {
		expect(parseFolderGroups("Notes = a, b, c")).toEqual([
			{ name: "Notes", paths: ["a", "b", "c"] },
		]);
	});

	test("trims whitespace and strips trailing slashes from paths", () => {
		expect(parseFolderGroups("  Spaces  =  foo/  ,  bar/baz/  ")).toEqual([
			{ name: "Spaces", paths: ["foo", "bar/baz"] },
		]);
	});

	test("skips empty lines and comments", () => {
		const text = `# this is a header
Projects = a

# another comment
Archive = b`;
		expect(parseFolderGroups(text)).toEqual([
			{ name: "Projects", paths: ["a"] },
			{ name: "Archive", paths: ["b"] },
		]);
	});

	test("ignores lines without =", () => {
		expect(parseFolderGroups("just a folder name\nProjects = a")).toEqual([
			{ name: "Projects", paths: ["a"] },
		]);
	});

	test("ignores groups with no name or no paths", () => {
		const text = `= some path
Empty =
Real = path`;
		expect(parseFolderGroups(text)).toEqual([
			{ name: "Real", paths: ["path"] },
		]);
	});

	test("preserves group order", () => {
		const text = `Z = z
A = a
M = m`;
		expect(parseFolderGroups(text).map(g => g.name)).toEqual(["Z", "A", "M"]);
	});
});

describe("serializeFolderGroups", () => {
	test("round-trips through parseFolderGroups", () => {
		const groups = [
			{ name: "Projects", paths: ["01. Проекты", "_Системные/Проекты"] },
			{ name: "Areas", paths: ["02. Сферы"] },
		];
		expect(parseFolderGroups(serializeFolderGroups(groups))).toEqual(groups);
	});

	test("empty groups serialize to empty string", () => {
		expect(serializeFolderGroups([])).toBe("");
	});
});

describe("count", () => {
	test("pluralises", () => {
		expect(count(0, "group")).toBe("No groups");
		expect(count(1, "group")).toBe("1 group");
		expect(count(4, "canonical tag")).toBe("4 canonical tags");
	});
});

/** Every definition in the tree, parents before their children. */
function* walk(defs: AnyDef[]): Generator<AnyDef> {
	for (const def of defs) {
		yield def;
		const nested = (def as { items?: AnyDef[] }).items;
		if (nested) yield* walk(nested);
	}
}

type AnyDef = SettingDefinitionItem<SettingsKey>;
type ControlDef = Extract<AnyDef, { control: unknown }>;
type ListDef = Extract<AnyDef, { type: 'list' }>;

function isControl(def: AnyDef): def is ControlDef {
	return 'control' in def && !!def.control;
}

function resolve<T>(value: T | (() => T) | undefined, fallback: T): T {
	if (value === undefined) return fallback;
	return typeof value === 'function' ? (value as () => T)() : value;
}

function makeTab(overrides: Partial<FullStatisticsPluginSettings> = {}) {
	const settings: FullStatisticsPluginSettings = { ...DEFAULT_SETTINGS, ...overrides };
	const saveSettings = jest.fn(async () => undefined);
	const restartCollector = jest.fn();
	const plugin = { settings, saveSettings, restartCollector };
	type PluginArg = ConstructorParameters<typeof FullStatisticsPluginSettingTab>[1];
	const tab = new FullStatisticsPluginSettingTab({} as never, plugin as unknown as PluginArg);
	return { tab, settings, saveSettings, restartCollector };
}

function defs(overrides: Partial<FullStatisticsPluginSettings> = {}): AnyDef[] {
	return makeTab(overrides).tab.getSettingDefinitions();
}

/** The list that follows the labelled row carrying `name`. */
function listAfter(all: AnyDef[], name: string): ListDef {
	const flat = [...walk(all)];
	const idx = flat.findIndex(d => 'name' in d && d.name === name);
	expect(idx).toBeGreaterThanOrEqual(0);
	const list = flat[idx + 1];
	expect((list as ListDef).type).toBe('list');
	return list as ListDef;
}

/** Keys managed by a list editor rather than a bound control. */
const LIST_MANAGED_KEYS: SettingsKey[] = [
	"excludedFolders",
	"ownTags",
	"sourceTags",
	"conceptTags",
	"canonicalTags",
	"inboxFolders",
	"inboxReviewTags",
	"folderGroups",
	"tanglesExclude",
];

describe("getSettingDefinitions", () => {
	test("every bound key is a real setting", () => {
		for (const def of walk(defs())) {
			if (!isControl(def)) continue;
			expect(Object.keys(DEFAULT_SETTINGS)).toContain(def.control.key);
		}
	});

	test("every bound control declares the shipped default", () => {
		for (const def of walk(defs())) {
			if (!isControl(def)) continue;
			const control = def.control as { key: SettingsKey; defaultValue?: unknown };
			expect(control.defaultValue).toEqual(DEFAULT_SETTINGS[control.key]);
		}
	});

	test("every setting reaches the UI — bound to a control or owned by a list", () => {
		const bound = new Set<string>();
		for (const def of walk(defs())) {
			if (isControl(def)) bound.add(def.control.key);
		}
		const unreachable = (Object.keys(DEFAULT_SETTINGS) as SettingsKey[])
			.filter(key => !bound.has(key) && !LIST_MANAGED_KEYS.includes(key));
		expect(unreachable).toEqual([]);
	});

	test("no two controls bind the same key", () => {
		const keys = [...walk(defs())].filter(isControl).map(d => d.control.key);
		expect(keys).toEqual([...new Set(keys)]);
	});
});

describe("visibility predicates", () => {
	function group(all: AnyDef[], heading: string) {
		return [...walk(all)].find(d => 'heading' in d && d.heading === heading)!;
	}

	test("status bar item toggles follow displayIndividualItems", () => {
		expect(resolve(group(defs({ displayIndividualItems: false }), "Status bar items").visible, true)).toBe(false);
		expect(resolve(group(defs({ displayIndividualItems: true }), "Status bar items").visible, true)).toBe(true);
	});

	test("tangles thresholds follow the selection mode", () => {
		const visibleNames = (mode: FullStatisticsPluginSettings['tanglesMode']) =>
			[...walk(defs({ tanglesMode: mode }))]
				.filter(d => 'name' in d && resolve(d.visible, true))
				.map(d => (d as { name: string }).name);

		expect(visibleNames('and')).toEqual(expect.arrayContaining(["Min incoming links", "Min outgoing links"]));
		expect(visibleNames('and')).not.toContain("Min in + out");

		expect(visibleNames('or')).toEqual(expect.arrayContaining(["Min incoming links", "Min outgoing links"]));
		expect(visibleNames('or')).not.toContain("Min in + out");

		expect(visibleNames('sum')).toContain("Min in + out");
		expect(visibleNames('sum')).not.toContain("Min incoming links");
	});
});

describe("control validation", () => {
	function validator(all: AnyDef[], name: string) {
		const def = [...walk(all)].find(d => 'name' in d && d.name === name) as ControlDef;
		return (def.control as { validate?: (v: number) => string | void }).validate!;
	}

	test("rare tag threshold demands a positive whole number", () => {
		const validate = validator(defs(), "Rare tag threshold");
		expect(validate(3)).toBeUndefined();
		expect(validate(1)).toBeUndefined();
		expect(validate(0)).toEqual(expect.any(String));
		expect(validate(-2)).toEqual(expect.any(String));
		expect(validate(2.5)).toEqual(expect.any(String));
	});

	test("tangles counts allow zero but not negatives or fractions", () => {
		const validate = validator(defs(), "Top N");
		expect(validate(0)).toBeUndefined();
		expect(validate(25)).toBeUndefined();
		expect(validate(-1)).toEqual(expect.any(String));
		expect(validate(1.5)).toEqual(expect.any(String));
	});
});

describe("page summaries", () => {
	function page(all: AnyDef[], name: string) {
		return [...walk(all)].find(d => 'type' in d && d.type === 'page' && d.name === name) as
			Extract<AnyDef, { type: 'page' }>;
	}

	test("a section that renders nothing is flagged", () => {
		const enabledButEmpty = defs({ showFolderBreakdown: true, folderGroups: [] });
		expect(resolve(page(enabledButEmpty, "Folder breakdown").status, null)).toBe('warning');

		const configured = defs({ showFolderBreakdown: true, folderGroups: [{ name: "P", paths: ["a"] }] });
		expect(resolve(page(configured, "Folder breakdown").status, null)).toBeNull();

		const off = defs({ showFolderBreakdown: false, folderGroups: [] });
		expect(resolve(page(off, "Folder breakdown").status, null)).toBeNull();
	});

	test("inbox needs either a folder or a review tag", () => {
		const neither = defs({ showInbox: true, inboxFolders: [], inboxReviewTags: [] });
		expect(resolve(page(neither, "Inbox health").status, null)).toBe('warning');

		const tagsOnly = defs({ showInbox: true, inboxFolders: [], inboxReviewTags: ["inbox/review"] });
		expect(resolve(page(tagsOnly, "Inbox health").status, null)).toBeNull();
	});

	test("taxonomy drift without a canonical set is noise", () => {
		const empty = defs({ showTaxonomyDrift: true, canonicalTags: [] });
		expect(resolve(page(empty, "Taxonomy drift").status, null)).toBe('warning');
	});

	test("display values summarise the page", () => {
		const all = defs({ showInbox: true, inboxFolders: ["00. Inbox", "Clippings"] });
		expect(resolve(page(all, "Inbox health").displayValue, "")).toBe("2 folders");
		expect(resolve(page(defs({ showInbox: false }), "Inbox health").displayValue, "")).toBe("Off");
	});

	test("tangles summarises the active mode", () => {
		expect(resolve(page(defs({ tanglesMode: 'and', tanglesMinIn: 4, tanglesMinOut: 7 }), "Tangles").displayValue, ""))
			.toBe("AND ≥ 4/7");
		expect(resolve(page(defs({ tanglesMode: 'sum', tanglesMinTotal: 12 }), "Tangles").displayValue, ""))
			.toBe("SUM ≥ 12");
	});
});

describe("list mutation", () => {
	test("delete removes the entry at that index and persists", async () => {
		const { tab, settings, saveSettings, restartCollector } = makeTab({
			ownTags: ["a", "b", "c"],
		});
		listAfter(tab.getSettingDefinitions(), "Own tags").onDelete!(1);
		await Promise.resolve();

		expect(settings.ownTags).toEqual(["a", "c"]);
		expect(saveSettings).toHaveBeenCalled();
		expect(restartCollector).toHaveBeenCalled();
	});

	test("reorder moves the entry to the new index", async () => {
		const { tab, settings } = makeTab({ ownTags: ["a", "b", "c"] });
		listAfter(tab.getSettingDefinitions(), "Own tags").onReorder!(0, 2);
		await Promise.resolve();

		expect(settings.ownTags).toEqual(["b", "c", "a"]);
	});

	test("reorder is a move, not a swap", async () => {
		const { tab, settings } = makeTab({ ownTags: ["a", "b", "c", "d"] });
		listAfter(tab.getSettingDefinitions(), "Own tags").onReorder!(3, 1);
		await Promise.resolve();

		expect(settings.ownTags).toEqual(["a", "d", "b", "c"]);
	});

	test("free-text lists append a blank row to type into", async () => {
		const { tab, settings } = makeTab({ ownTags: ["a"] });
		listAfter(tab.getSettingDefinitions(), "Own tags").addItem!.action(null as never);
		await Promise.resolve();

		expect(settings.ownTags).toEqual(["a", ""]);
	});

	test("lists that do not feed the collector do not trigger a rescan", async () => {
		const { tab, settings, restartCollector } = makeTab({ canonicalTags: ["x", "y"] });
		listAfter(tab.getSettingDefinitions(), "Canonical tags").onDelete!(0);
		await Promise.resolve();

		expect(settings.canonicalTags).toEqual(["y"]);
		expect(restartCollector).not.toHaveBeenCalled();
	});

	test("folder groups delete by index", async () => {
		const { tab, settings } = makeTab({
			folderGroups: [
				{ name: "P", paths: ["a"] },
				{ name: "A", paths: ["b"] },
			],
		});
		listAfter(tab.getSettingDefinitions(), "Folder groups (PARA)").onDelete!(0);
		await Promise.resolve();

		expect(settings.folderGroups).toEqual([{ name: "A", paths: ["b"] }]);
	});
});

describe("setControlValue", () => {
	test("writes through the plugin so history is not dropped", async () => {
		const { tab, settings, saveSettings } = makeTab();
		await tab.setControlValue('showHistory', true);

		expect(settings.showHistory).toBe(true);
		expect(saveSettings).toHaveBeenCalledTimes(1);
	});

	test("collector-backed keys rescan, presentation-only keys do not", async () => {
		const collector = makeTab();
		await collector.tab.setControlValue('excludedFolders', ["Templates"]);
		expect(collector.restartCollector).toHaveBeenCalled();

		const presentation = makeTab();
		await presentation.tab.setControlValue('showHistory', true);
		expect(presentation.restartCollector).not.toHaveBeenCalled();
	});

	test("reads back what it wrote", async () => {
		const { tab } = makeTab();
		await tab.setControlValue('rareTagThreshold', 7);
		expect(tab.getControlValue('rareTagThreshold')).toBe(7);
	});
});
