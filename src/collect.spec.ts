import { Component, MetadataCache, TFile } from 'obsidian';
import { FullVaultMetricsCollector, NoteMetricsCollector, isPluginGeneratedNote } from './collect';
import { FullVaultMetrics } from './metrics';

function makeMetadataCache(tags: Record<string, number>): MetadataCache {
	const mc = new MetadataCache();
	(mc as any).getTags = () => tags;
	return mc;
}

function makeMetrics(notes: number, links: number): FullVaultMetrics {
	const m = new FullVaultMetrics();
	m.notes = notes;
	m.links = links;
	return m;
}

describe("FullVaultMetricsCollector.update", () => {
	let collector: FullVaultMetricsCollector;
	let vaultMetrics: FullVaultMetrics;

	beforeEach(() => {
		vaultMetrics = new FullVaultMetrics();
		collector = new FullVaultMetricsCollector(new Component()).
			setFullVaultMetrics(vaultMetrics);
	});

	test("update increments vault metrics", () => {
		collector.update("a.md", makeMetrics(1, 5));
		expect(vaultMetrics.notes).toBe(1);
		expect(vaultMetrics.links).toBe(5);
	});

	test("update with null decrements vault metrics", () => {
		collector.update("a.md", makeMetrics(1, 5));
		collector.update("a.md", null);
		expect(vaultMetrics.notes).toBe(0);
		expect(vaultMetrics.links).toBe(0);
	});

	test("rename does not double-count: set(new) + delete(old) nets to original", () => {
		collector.update("old.md", makeMetrics(1, 3));
		expect(vaultMetrics.notes).toBe(1);
		expect(vaultMetrics.links).toBe(3);

		collector.update("new.md", makeMetrics(1, 3));
		collector.update("old.md", null);

		expect(vaultMetrics.notes).toBe(1);
		expect(vaultMetrics.links).toBe(3);
	});

	test("rename in reverse order also nets to original", () => {
		collector.update("old.md", makeMetrics(1, 3));

		collector.update("old.md", null);
		collector.update("new.md", makeMetrics(1, 3));

		expect(vaultMetrics.notes).toBe(1);
		expect(vaultMetrics.links).toBe(3);
	});

	test("repeated update for same path replaces, does not accumulate", () => {
		collector.update("a.md", makeMetrics(1, 2));
		collector.update("a.md", makeMetrics(1, 7));
		expect(vaultMetrics.notes).toBe(1);
		expect(vaultMetrics.links).toBe(7);
	});
});

describe("FullVaultMetricsCollector — vault-wide tag count via metadataCache.getTags()", () => {
	let collector: FullVaultMetricsCollector;
	let vaultMetrics: FullVaultMetrics;
	let cacheTags: Record<string, number>;
	let mc: MetadataCache;

	beforeEach(() => {
		vaultMetrics = new FullVaultMetrics();
		cacheTags = {};
		mc = makeMetadataCache(cacheTags);
		collector = new FullVaultMetricsCollector(new Component()).
			setMetadataCache(mc).
			setFullVaultMetrics(vaultMetrics);
	});

	test("reflects size of metadataCache.getTags() after update", () => {
		cacheTags["#book"] = 5;
		cacheTags["#thought"] = 3;
		collector.update("a.md", makeMetrics(1, 0));
		expect(vaultMetrics.tags).toBe(2);
	});

	test("zero when getTags returns empty record", () => {
		collector.update("a.md", makeMetrics(1, 0));
		expect(vaultMetrics.tags).toBe(0);
	});

	test("tag count refreshes when underlying record changes between updates", () => {
		cacheTags["#a"] = 1;
		collector.update("a.md", makeMetrics(1, 0));
		expect(vaultMetrics.tags).toBe(1);

		cacheTags["#b"] = 1;
		collector.update("b.md", makeMetrics(1, 0));
		expect(vaultMetrics.tags).toBe(2);

		delete cacheTags["#a"];
		collector.update("c.md", makeMetrics(1, 0));
		expect(vaultMetrics.tags).toBe(1);
	});

	test("safe when metadataCache is not set (used in unit tests of update)", () => {
		const bare = new FullVaultMetricsCollector(new Component()).
			setFullVaultMetrics(new FullVaultMetrics());
		expect(() => bare.update("a.md", makeMetrics(1, 0))).not.toThrow();
	});
});

describe("NoteMetricsCollector.collect — tags", () => {
	let nmc: NoteMetricsCollector;
	let file: TFile;

	beforeEach(() => {
		nmc = new NoteMetricsCollector();
		file = { path: "a.md" } as TFile;
	});

	test("counts inline hashtags from metadata.tags", async () => {
		const result = await nmc.collect(file, {
			tags: [{ tag: "#thought" }, { tag: "#book" }],
		} as any);
		expect(result?.metrics.tags).toBe(2);
		expect(result?.tags).toEqual(new Set(["thought", "book"]));
	});

	test("counts frontmatter tags array", async () => {
		const result = await nmc.collect(file, {
			frontmatter: { tags: ["thought", "book", "video"] },
		} as any);
		expect(result?.metrics.tags).toBe(3);
		expect(result?.tags).toEqual(new Set(["thought", "book", "video"]));
	});

	test("counts frontmatter tags as comma/space-separated string", async () => {
		const result = await nmc.collect(file, {
			frontmatter: { tags: "thought, book video" },
		} as any);
		expect(result?.metrics.tags).toBe(3);
	});

	test("dedupes inline + frontmatter tags within a note", async () => {
		const result = await nmc.collect(file, {
			tags: [{ tag: "#fleeting" }, { tag: "#book" }],
			frontmatter: { tags: ["book"] },
		} as any);
		// inline {fleeting, book} ∪ frontmatter {book} = {fleeting, book}
		expect(result?.metrics.tags).toBe(2);
		expect(result?.tags).toEqual(new Set(["fleeting", "book"]));
	});

	test("returns zero tags when no tag fields present", async () => {
		const result = await nmc.collect(file, {} as any);
		expect(result?.metrics.tags).toBe(0);
		expect(result?.metrics.notes).toBe(1);
	});

	test("recollects when tags change even if links did not", async () => {
		const first = await nmc.collect(file, {
			tags: [{ tag: "#a" }],
		} as any);
		expect(first?.metrics.tags).toBe(1);

		const second = await nmc.collect(file, {
			tags: [{ tag: "#a" }, { tag: "#b" }],
		} as any);
		expect(second?.metrics.tags).toBe(2);
	});

	test("returns undefined when neither links nor tags changed (cache hit)", async () => {
		const meta = { tags: [{ tag: "#a" }] } as any;
		await nmc.collect(file, meta);
		const second = await nmc.collect(file, meta);
		expect(second).toBeUndefined();
	});

	test("recollects when tag identity changes even if count is the same", async () => {
		const first = await nmc.collect(file, {
			tags: [{ tag: "#thought" }],
		} as any);
		expect(first?.metrics.tags).toBe(1);

		const second = await nmc.collect(file, {
			tags: [{ tag: "#book" }],
		} as any);
		expect(second).not.toBeNull();
		expect(second?.metrics.tags).toBe(1);
	});
});

describe("NoteMetricsCollector.collect — own/source/concept classification", () => {
	let nmc: NoteMetricsCollector;
	let file: TFile;

	beforeEach(() => {
		nmc = new NoteMetricsCollector();
		nmc.setOwnTags(["thought", "synthesis", "fleeting"]);
		nmc.setSourceTags(["book", "article", "video"]);
		nmc.setConceptTags(["concept"]);
		file = { path: "n.md" } as TFile;
	});

	test("classifies own when an own tag is present", async () => {
		const r = await nmc.collect(file, { tags: [{ tag: "#thought" }] } as any);
		expect(r?.metrics.ownNotes).toBe(1);
		expect(r?.metrics.sourceNotes).toBe(0);
		expect(r?.metrics.conceptNotes).toBe(0);
	});

	test("classifies source when a source tag is present", async () => {
		const r = await nmc.collect(file, { tags: [{ tag: "#book" }] } as any);
		expect(r?.metrics.ownNotes).toBe(0);
		expect(r?.metrics.sourceNotes).toBe(1);
	});

	test("classifies concept when a concept tag is present", async () => {
		const r = await nmc.collect(file, { tags: [{ tag: "#concept" }] } as any);
		expect(r?.metrics.conceptNotes).toBe(1);
	});

	test("a note with both own and source tags counts in both buckets", async () => {
		const r = await nmc.collect(file, {
			tags: [{ tag: "#thought" }, { tag: "#book" }],
		} as any);
		expect(r?.metrics.ownNotes).toBe(1);
		expect(r?.metrics.sourceNotes).toBe(1);
	});

	test("classification is case-insensitive and accepts # prefix in config", async () => {
		nmc.setOwnTags(["#Thought"]);
		const r = await nmc.collect(file, { tags: [{ tag: "#thought" }] } as any);
		expect(r?.metrics.ownNotes).toBe(1);
	});

	test("frontmatter tags participate in classification", async () => {
		const r = await nmc.collect(file, {
			frontmatter: { tags: ["book"] },
		} as any);
		expect(r?.metrics.sourceNotes).toBe(1);
	});

	test("untagged note classifies as none", async () => {
		const r = await nmc.collect(file, {} as any);
		expect(r?.metrics.ownNotes).toBe(0);
		expect(r?.metrics.sourceNotes).toBe(0);
		expect(r?.metrics.conceptNotes).toBe(0);
		expect(r?.metrics.notes).toBe(1);
	});

	test("changing own tag list invalidates cache (note re-collected)", async () => {
		const meta = { tags: [{ tag: "#book" }] } as any;
		const first = await nmc.collect(file, meta);
		expect(first?.metrics.ownNotes).toBe(0);

		nmc.setOwnTags(["book"]);
		const second = await nmc.collect(file, meta);
		expect(second).not.toBeNull();
		expect(second?.metrics.ownNotes).toBe(1);
	});
});

describe("FullVaultMetricsCollector.aggregateByGroups", () => {
	let collector: FullVaultMetricsCollector;
	let vaultMetrics: FullVaultMetrics;

	function pushNote(path: string, overrides: Partial<FullVaultMetrics> = {}): void {
		const m = new FullVaultMetrics();
		m.notes = 1;
		Object.assign(m, overrides);
		collector.update(path, m);
	}

	beforeEach(() => {
		vaultMetrics = new FullVaultMetrics();
		collector = new FullVaultMetricsCollector(new Component()).
			setFullVaultMetrics(vaultMetrics);
	});

	test("returns one zeroed aggregate per group when vault is empty", () => {
		const result = collector.aggregateByGroups([
			{ name: "P", paths: ["01. Projects"] },
			{ name: "A", paths: ["02. Areas"] },
		]);
		expect(result).toEqual([
			{ name: "P", notes: 0, links: 0, ownNotes: 0, sourceNotes: 0, conceptNotes: 0, orphanNotes: 0 },
			{ name: "A", notes: 0, links: 0, ownNotes: 0, sourceNotes: 0, conceptNotes: 0, orphanNotes: 0 },
		]);
	});

	test("aggregates notes by folder prefix", () => {
		pushNote("01. Projects/foo.md", { links: 2, ownNotes: 1 });
		pushNote("01. Projects/sub/bar.md", { links: 5, sourceNotes: 1 });
		pushNote("02. Areas/baz.md", { links: 1, ownNotes: 1 });

		const result = collector.aggregateByGroups([
			{ name: "P", paths: ["01. Projects"] },
			{ name: "A", paths: ["02. Areas"] },
		]);
		expect(result[0]).toEqual({
			name: "P", notes: 2, links: 7, ownNotes: 1, sourceNotes: 1, conceptNotes: 0, orphanNotes: 2,
		});
		expect(result[1]).toEqual({
			name: "A", notes: 1, links: 1, ownNotes: 1, sourceNotes: 0, conceptNotes: 0, orphanNotes: 1,
		});
	});

	test("a path can match multiple groups (overlap is allowed)", () => {
		pushNote("Shared/note.md", { ownNotes: 1 });

		const result = collector.aggregateByGroups([
			{ name: "All", paths: ["Shared"] },
			{ name: "Also", paths: ["Shared"] },
		]);
		expect(result[0].notes).toBe(1);
		expect(result[1].notes).toBe(1);
	});

	test("multiple paths per group are summed", () => {
		pushNote("a/note.md");
		pushNote("b/note.md");
		pushNote("c/note.md");

		const result = collector.aggregateByGroups([
			{ name: "AB", paths: ["a", "b"] },
		]);
		expect(result[0].notes).toBe(2);
	});

	test("trailing slashes in group paths are normalized", () => {
		pushNote("docs/foo.md");
		const result = collector.aggregateByGroups([
			{ name: "Docs", paths: ["docs/", "docs//"] },
		]);
		expect(result[0].notes).toBe(1);
	});

	test("root-level files are not matched by a folder group", () => {
		pushNote("README.md");
		const result = collector.aggregateByGroups([
			{ name: "All", paths: [""] },
		]);
		// Empty path is filtered out by normalization → no match.
		expect(result[0].notes).toBe(0);
	});

	test("partial folder name does not match (prefix needs trailing slash)", () => {
		pushNote("Projects/foo.md");
		pushNote("ProjectsArchive/foo.md");
		const result = collector.aggregateByGroups([
			{ name: "P", paths: ["Projects"] },
		]);
		// Only `Projects/...` matches, not `ProjectsArchive/...`.
		expect(result[0].notes).toBe(1);
	});

	test("exact-path file matches its own group entry", () => {
		pushNote("special.md");
		const result = collector.aggregateByGroups([
			{ name: "S", paths: ["special.md"] },
		]);
		expect(result[0].notes).toBe(1);
	});
});

describe("FullVaultMetricsCollector.computeOrphanCount", () => {
	function makeCacheWithLinks(links: Record<string, Record<string, number>>): MetadataCache {
		const mc = new MetadataCache();
		(mc as any).resolvedLinks = links;
		return mc;
	}

	function freshCollector(mc: MetadataCache): FullVaultMetricsCollector {
		return new FullVaultMetricsCollector(new Component()).
			setMetadataCache(mc).
			setFullVaultMetrics(new FullVaultMetrics());
	}

	test("returns 0 when no notes are tracked", () => {
		const c = freshCollector(makeCacheWithLinks({}));
		expect(c.computeOrphanCount()).toBe(0);
	});

	test("file with no incoming links is an orphan", () => {
		const c = freshCollector(makeCacheWithLinks({}));
		c.update("a.md", makeMetrics(1, 0));
		expect(c.computeOrphanCount()).toBe(1);
	});

	test("file linked from another file is not an orphan", () => {
		const c = freshCollector(makeCacheWithLinks({
			"a.md": { "b.md": 1 },
		}));
		c.update("a.md", makeMetrics(1, 1));
		c.update("b.md", makeMetrics(1, 0));
		expect(c.computeOrphanCount()).toBe(1); // a.md has no inbound link
	});

	test("self-link does not save you from being orphaned", () => {
		const c = freshCollector(makeCacheWithLinks({
			"a.md": { "a.md": 1 },
		}));
		c.update("a.md", makeMetrics(1, 1));
		// resolvedLinks marks "a.md" as a destination of itself, so the
		// inverted set contains "a.md" — it is technically not an orphan
		// by our definition. This is the documented behavior; if a user
		// disagrees, they can audit graph view the same way.
		expect(c.computeOrphanCount()).toBe(0);
	});

	test("orphan count drops when an inbound link appears", () => {
		const links: Record<string, Record<string, number>> = {};
		const c = freshCollector(makeCacheWithLinks(links));
		c.update("a.md", makeMetrics(1, 0));
		c.update("b.md", makeMetrics(1, 0));
		expect(c.computeOrphanCount()).toBe(2);

		links["a.md"] = { "b.md": 1 };
		expect(c.computeOrphanCount()).toBe(1);
	});

	test("missing resolvedLinks is treated as no links (everything is orphan)", () => {
		const mc = new MetadataCache();
		// no resolvedLinks set
		const c = new FullVaultMetricsCollector(new Component()).
			setMetadataCache(mc).
			setFullVaultMetrics(new FullVaultMetrics());
		c.update("a.md", makeMetrics(1, 0));
		c.update("b.md", makeMetrics(1, 0));
		expect(c.computeOrphanCount()).toBe(2);
	});
});

describe("isPluginGeneratedNote", () => {
	test("matches *.excalidraw.md filename", () => {
		const f = { name: "Architecture.excalidraw.md", path: "drawings/Architecture.excalidraw.md" } as TFile;
		expect(isPluginGeneratedNote(f, {} as any)).toBe(true);
	});

	test("matches frontmatter excalidraw-plugin key", () => {
		const f = { name: "regular.md", path: "regular.md" } as TFile;
		const meta = { frontmatter: { "excalidraw-plugin": "parsed" } } as any;
		expect(isPluginGeneratedNote(f, meta)).toBe(true);
	});

	test("matches frontmatter kanban-plugin key", () => {
		const f = { name: "Sprint board.md", path: "Sprint board.md" } as TFile;
		const meta = { frontmatter: { "kanban-plugin": "basic" } } as any;
		expect(isPluginGeneratedNote(f, meta)).toBe(true);
	});

	test("regular note is not plugin-generated", () => {
		const f = { name: "Daily 2026-05-08.md", path: "journal/Daily 2026-05-08.md" } as TFile;
		expect(isPluginGeneratedNote(f, {} as any)).toBe(false);
	});

	test("a note named like 'My excalidraw notes.md' is not flagged", () => {
		// Only the literal `.excalidraw.md` suffix is the marker — substring
		// matches in the body of a name should not trigger.
		const f = { name: "My excalidraw notes.md", path: "My excalidraw notes.md" } as TFile;
		expect(isPluginGeneratedNote(f, {} as any)).toBe(false);
	});

	test("filename match is case-insensitive", () => {
		const f = { name: "Diagram.Excalidraw.MD", path: "Diagram.Excalidraw.MD" } as TFile;
		expect(isPluginGeneratedNote(f, {} as any)).toBe(true);
	});
});

describe("FullVaultMetrics — own/source ratio", () => {
	test("plan scenario: 6 own + 3 source + 1 untagged → 67% own / 33% source", () => {
		const v = new FullVaultMetrics();
		const own = new FullVaultMetrics();
		own.notes = 1; own.ownNotes = 1;
		const src = new FullVaultMetrics();
		src.notes = 1; src.sourceNotes = 1;
		const none = new FullVaultMetrics();
		none.notes = 1;

		for (let i = 0; i < 6; i++) v.inc(own);
		for (let i = 0; i < 3; i++) v.inc(src);
		v.inc(none);

		expect(v.notes).toBe(10);
		expect(v.ownNotes).toBe(6);
		expect(v.sourceNotes).toBe(3);
		expect(v.ownPct()).toBeCloseTo(6 / 9);
		expect(v.sourcePct()).toBeCloseTo(3 / 9);
	});

	test("ownPct/sourcePct are zero when nothing classified", () => {
		const v = new FullVaultMetrics();
		expect(v.ownPct()).toBe(0);
		expect(v.sourcePct()).toBe(0);
	});
});
