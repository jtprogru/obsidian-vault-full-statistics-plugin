import { Component, MetadataCache, TFile } from 'obsidian';
import { FullVaultMetricsCollector, NoteMetricsCollector } from './collect';
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

	test("returns null when neither links nor tags changed", async () => {
		const meta = { tags: [{ tag: "#a" }] } as any;
		await nmc.collect(file, meta);
		const second = await nmc.collect(file, meta);
		expect(second).toBeNull();
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
