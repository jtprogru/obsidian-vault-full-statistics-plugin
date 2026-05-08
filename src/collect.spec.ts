import { Component, TFile } from 'obsidian';
import { FullVaultMetricsCollector, NoteMetricsCollector } from './collect';
import { FullVaultMetrics } from './metrics';

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
		// Simulates initial collection of "old.md".
		collector.update("old.md", makeMetrics(1, 3));
		expect(vaultMetrics.notes).toBe(1);
		expect(vaultMetrics.links).toBe(3);

		// Simulates the two events processBacklog produces after a rename:
		// new path is collected fresh, old path resolves to null (file is gone).
		collector.update("new.md", makeMetrics(1, 3));
		collector.update("old.md", null);

		expect(vaultMetrics.notes).toBe(1);
		expect(vaultMetrics.links).toBe(3);
	});

	test("rename in reverse order also nets to original", () => {
		collector.update("old.md", makeMetrics(1, 3));

		// Order swapped — Promise.allSettled in processBacklog does not
		// guarantee ordering, so the result must be invariant.
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

describe("NoteMetricsCollector.collect — tags", () => {
	let nmc: NoteMetricsCollector;
	let file: TFile;

	beforeEach(() => {
		nmc = new NoteMetricsCollector();
		file = { path: "a.md" } as TFile;
	});

	test("counts inline hashtags from metadata.tags", async () => {
		const metrics = await nmc.collect(file, {
			tags: [{ tag: "#thought" }, { tag: "#book" }],
		} as any);
		expect(metrics?.tags).toBe(2);
	});

	test("counts frontmatter tags array", async () => {
		const metrics = await nmc.collect(file, {
			frontmatter: { tags: ["thought", "book", "video"] },
		} as any);
		expect(metrics?.tags).toBe(3);
	});

	test("counts frontmatter tags as comma/space-separated string", async () => {
		const metrics = await nmc.collect(file, {
			frontmatter: { tags: "thought, book video" },
		} as any);
		expect(metrics?.tags).toBe(3);
	});

	test("sums inline + frontmatter tags", async () => {
		const metrics = await nmc.collect(file, {
			tags: [{ tag: "#fleeting" }],
			frontmatter: { tags: ["book"] },
		} as any);
		expect(metrics?.tags).toBe(2);
	});

	test("returns zero tags when no tag fields present", async () => {
		const metrics = await nmc.collect(file, {} as any);
		expect(metrics?.tags).toBe(0);
		expect(metrics?.notes).toBe(1);
	});

	test("recollects when tags change even if links did not", async () => {
		const first = await nmc.collect(file, {
			tags: [{ tag: "#a" }],
		} as any);
		expect(first?.tags).toBe(1);

		const second = await nmc.collect(file, {
			tags: [{ tag: "#a" }, { tag: "#b" }],
		} as any);
		expect(second?.tags).toBe(2);
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
		expect(first?.tags).toBe(1);

		const second = await nmc.collect(file, {
			tags: [{ tag: "#book" }],
		} as any);
		expect(second).not.toBeNull();
		expect(second?.tags).toBe(1);
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
		const m = await nmc.collect(file, { tags: [{ tag: "#thought" }] } as any);
		expect(m?.ownNotes).toBe(1);
		expect(m?.sourceNotes).toBe(0);
		expect(m?.conceptNotes).toBe(0);
	});

	test("classifies source when a source tag is present", async () => {
		const m = await nmc.collect(file, { tags: [{ tag: "#book" }] } as any);
		expect(m?.ownNotes).toBe(0);
		expect(m?.sourceNotes).toBe(1);
	});

	test("classifies concept when a concept tag is present", async () => {
		const m = await nmc.collect(file, { tags: [{ tag: "#concept" }] } as any);
		expect(m?.conceptNotes).toBe(1);
	});

	test("a note with both own and source tags counts in both buckets", async () => {
		const m = await nmc.collect(file, {
			tags: [{ tag: "#thought" }, { tag: "#book" }],
		} as any);
		expect(m?.ownNotes).toBe(1);
		expect(m?.sourceNotes).toBe(1);
	});

	test("classification is case-insensitive and accepts # prefix in config", async () => {
		nmc.setOwnTags(["#Thought"]);
		const m = await nmc.collect(file, { tags: [{ tag: "#thought" }] } as any);
		expect(m?.ownNotes).toBe(1);
	});

	test("frontmatter tags participate in classification", async () => {
		const m = await nmc.collect(file, {
			frontmatter: { tags: ["book"] },
		} as any);
		expect(m?.sourceNotes).toBe(1);
	});

	test("untagged note classifies as none", async () => {
		const m = await nmc.collect(file, {} as any);
		expect(m?.ownNotes).toBe(0);
		expect(m?.sourceNotes).toBe(0);
		expect(m?.conceptNotes).toBe(0);
		expect(m?.notes).toBe(1);
	});

	test("changing own tag list invalidates cache (note re-collected)", async () => {
		const meta = { tags: [{ tag: "#book" }] } as any;
		const first = await nmc.collect(file, meta);
		expect(first?.ownNotes).toBe(0);

		nmc.setOwnTags(["book"]);
		const second = await nmc.collect(file, meta);
		expect(second).not.toBeNull();
		expect(second?.ownNotes).toBe(1);
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
