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
});
