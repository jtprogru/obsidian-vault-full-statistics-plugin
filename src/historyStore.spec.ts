import { HistoryStore, Snapshot, formatDate, sparkline, pctString } from './historyStore';
import { FullVaultMetrics } from './metrics';

function makeMetrics(overrides: Partial<FullVaultMetrics> = {}): FullVaultMetrics {
	const m = new FullVaultMetrics();
	Object.assign(m, overrides);
	return m;
}

function snap(date: string, notes: number, ownNotes = 0, sourceNotes = 0): Snapshot {
	return { date, notes, links: 0, tags: 0, ownNotes, sourceNotes, conceptNotes: 0 };
}

describe("HistoryStore.recordIfNeeded", () => {
	test("records first snapshot on empty store", () => {
		const h = new HistoryStore();
		const changed = h.recordIfNeeded(new Date("2026-05-08T10:00:00"), makeMetrics({ notes: 100 }));
		expect(changed).toBe(true);
		expect(h.size()).toBe(1);
		expect(h.lastDate()).toBe("2026-05-08");
	});

	test("does not duplicate snapshot when called twice the same day with same metrics", () => {
		const h = new HistoryStore();
		h.recordIfNeeded(new Date("2026-05-08T10:00:00"), makeMetrics({ notes: 100 }));
		const changed = h.recordIfNeeded(new Date("2026-05-08T18:00:00"), makeMetrics({ notes: 100 }));
		expect(changed).toBe(false);
		expect(h.size()).toBe(1);
	});

	test("overwrites today's snapshot when metrics changed during the day", () => {
		const h = new HistoryStore();
		h.recordIfNeeded(new Date("2026-05-08T10:00:00"), makeMetrics({ notes: 100 }));
		const changed = h.recordIfNeeded(new Date("2026-05-08T18:00:00"), makeMetrics({ notes: 105 }));
		expect(changed).toBe(true);
		expect(h.size()).toBe(1);
		expect(h.all()[0].notes).toBe(105);
	});

	test("appends a new snapshot on a new day", () => {
		const h = new HistoryStore();
		h.recordIfNeeded(new Date("2026-05-08T10:00:00"), makeMetrics({ notes: 100 }));
		h.recordIfNeeded(new Date("2026-05-09T10:00:00"), makeMetrics({ notes: 102 }));
		expect(h.size()).toBe(2);
		expect(h.all().map(s => s.date)).toEqual(["2026-05-08", "2026-05-09"]);
	});

	test("rotates oldest snapshot when exceeding max", () => {
		const h = new HistoryStore([], 3);
		h.recordIfNeeded(new Date("2026-05-01T00:00:00"), makeMetrics({ notes: 1 }));
		h.recordIfNeeded(new Date("2026-05-02T00:00:00"), makeMetrics({ notes: 2 }));
		h.recordIfNeeded(new Date("2026-05-03T00:00:00"), makeMetrics({ notes: 3 }));
		h.recordIfNeeded(new Date("2026-05-04T00:00:00"), makeMetrics({ notes: 4 }));
		expect(h.size()).toBe(3);
		expect(h.all().map(s => s.date)).toEqual(["2026-05-02", "2026-05-03", "2026-05-04"]);
	});

	test("captures own/source/concept fields", () => {
		const h = new HistoryStore();
		h.recordIfNeeded(new Date("2026-05-08T10:00:00"), makeMetrics({
			notes: 10, ownNotes: 6, sourceNotes: 3, conceptNotes: 1, links: 50, tags: 12,
		}));
		const s = h.all()[0];
		expect(s).toEqual({
			date: "2026-05-08",
			notes: 10,
			links: 50,
			tags: 12,
			ownNotes: 6,
			sourceNotes: 3,
			conceptNotes: 1,
		});
	});
});

describe("HistoryStore constructor", () => {
	test("sorts unsorted persisted snapshots", () => {
		const h = new HistoryStore([
			snap("2026-05-03", 3),
			snap("2026-05-01", 1),
			snap("2026-05-02", 2),
		]);
		expect(h.all().map(s => s.date)).toEqual(["2026-05-01", "2026-05-02", "2026-05-03"]);
	});

	test("trims oversized persisted history down to max", () => {
		const persisted = Array.from({ length: 10 }, (_, i) =>
			snap(`2026-05-${String(i + 1).padStart(2, "0")}`, i)
		);
		const h = new HistoryStore(persisted, 5);
		expect(h.size()).toBe(5);
		expect(h.all()[0].date).toBe("2026-05-06");
	});
});

describe("HistoryStore.recent", () => {
	test("returns last N snapshots", () => {
		const h = new HistoryStore();
		for (let i = 1; i <= 10; i++) {
			h.recordIfNeeded(new Date(`2026-05-${String(i).padStart(2, "0")}T00:00:00`), makeMetrics({ notes: i }));
		}
		expect(h.recent(3).map(s => s.notes)).toEqual([8, 9, 10]);
	});

	test("returns all when N exceeds size", () => {
		const h = new HistoryStore();
		h.recordIfNeeded(new Date("2026-05-01T00:00:00"), makeMetrics({ notes: 1 }));
		expect(h.recent(30).map(s => s.notes)).toEqual([1]);
	});

	test("empty result for non-positive days", () => {
		const h = new HistoryStore([snap("2026-05-01", 1)]);
		expect(h.recent(0)).toEqual([]);
		expect(h.recent(-1)).toEqual([]);
	});
});

describe("formatDate", () => {
	test("pads month and day", () => {
		expect(formatDate(new Date(2026, 0, 5))).toBe("2026-01-05");
	});
});

describe("sparkline", () => {
	test("returns empty string for empty input", () => {
		expect(sparkline([])).toBe("");
	});

	test("flat series renders all-low blocks", () => {
		expect(sparkline([5, 5, 5])).toBe("▁▁▁");
	});

	test("ascending series spans low to high", () => {
		const s = sparkline([0, 1, 2, 3, 4, 5, 6, 7]);
		expect(s.length).toBe(8);
		expect(s.charAt(0)).toBe("▁");
		expect(s.charAt(7)).toBe("█");
	});

	test("descending series ends at low", () => {
		const s = sparkline([8, 6, 4, 2, 0]);
		expect(s.charAt(0)).toBe("█");
		expect(s.charAt(s.length - 1)).toBe("▁");
	});
});

describe("pctString", () => {
	test("rounds to integer percent", () => {
		expect(pctString(0.6667)).toBe("67%");
		expect(pctString(0)).toBe("0%");
		expect(pctString(1)).toBe("100%");
	});
});
