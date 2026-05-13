import { Component, MetadataCache } from 'obsidian';
import { FullVaultMetricsCollector } from './collect';
import { FullVaultMetrics } from './metrics';
import {
	computeTangles,
	renderTanglesReport,
	wikilinkTargetForPath,
	TanglesSettings,
} from './tangles';

function makeMetadataCache(resolvedLinks: Record<string, Record<string, number>>): MetadataCache {
	const mc = new MetadataCache();
	(mc as any).resolvedLinks = resolvedLinks;
	return mc;
}

function freshCollector(mc: MetadataCache): FullVaultMetricsCollector {
	return new FullVaultMetricsCollector(new Component()).
		setMetadataCache(mc).
		setFullVaultMetrics(new FullVaultMetrics());
}

function bare(): FullVaultMetrics {
	const m = new FullVaultMetrics();
	m.notes = 1;
	return m;
}

function makeSettings(over: Partial<TanglesSettings> = {}): TanglesSettings {
	return {
		tanglesMode: 'and',
		tanglesMinIn: 1,
		tanglesMinOut: 1,
		tanglesMinTotal: 2,
		tanglesTopN: 0,
		tanglesExclude: [],
		...over,
	};
}

describe('computeTangles — selection modes', () => {
	function setup() {
		// Graph (resolved):
		//   hub.md → a.md, b.md, c.md            (out=3)
		//   a.md → hub.md                         (out=1)
		//   b.md → hub.md                         (out=1)
		//   c.md → hub.md                         (out=1)
		//   loner.md → nobody, nobody → loner.md  (in=0, out=0)
		// Incoming degree: hub=3, a=1, b=1, c=1
		// Outgoing degree: hub=3, a=1, b=1, c=1
		const mc = makeMetadataCache({
			'hub.md': { 'a.md': 1, 'b.md': 1, 'c.md': 1 },
			'a.md': { 'hub.md': 1 },
			'b.md': { 'hub.md': 1 },
			'c.md': { 'hub.md': 1 },
		});
		const c = freshCollector(mc);
		c.update('hub.md', bare());
		c.update('a.md', bare());
		c.update('b.md', bare());
		c.update('c.md', bare());
		c.update('loner.md', bare());
		return c;
	}

	test("AND mode requires both thresholds met", () => {
		const c = setup();
		const entries = computeTangles(c, makeSettings({
			tanglesMode: 'and',
			tanglesMinIn: 2,
			tanglesMinOut: 2,
		}));
		expect(entries.map(e => e.path)).toEqual(['hub.md']);
	});

	test("OR mode matches when either threshold passes", () => {
		const c = setup();
		const entries = computeTangles(c, makeSettings({
			tanglesMode: 'or',
			tanglesMinIn: 3,
			tanglesMinOut: 3,
		}));
		// Only hub has either >= 3.
		expect(entries.map(e => e.path)).toEqual(['hub.md']);
	});

	test("OR mode picks up notes that satisfy only one side", () => {
		const c = setup();
		const entries = computeTangles(c, makeSettings({
			tanglesMode: 'or',
			tanglesMinIn: 1,
			tanglesMinOut: 99,
		}));
		// in>=1 picks every linked note; out>=99 picks none.
		expect(entries.map(e => e.path).sort()).toEqual(['a.md', 'b.md', 'c.md', 'hub.md']);
	});

	test("SUM mode filters by combined degree only", () => {
		const c = setup();
		const entries = computeTangles(c, makeSettings({
			tanglesMode: 'sum',
			tanglesMinTotal: 5,
		}));
		// hub has 3+3=6; everyone else 1+1=2.
		expect(entries.map(e => e.path)).toEqual(['hub.md']);
	});

	test("loner (no in, no out) never appears regardless of mode if min > 0", () => {
		const c = setup();
		for (const mode of ['and', 'or', 'sum'] as const) {
			const entries = computeTangles(c, makeSettings({
				tanglesMode: mode,
				tanglesMinIn: 1,
				tanglesMinOut: 1,
				tanglesMinTotal: 1,
			}));
			expect(entries.find(e => e.path === 'loner.md')).toBeUndefined();
		}
	});

	test("zero thresholds make every tracked note a tangle", () => {
		const c = setup();
		const entries = computeTangles(c, makeSettings({
			tanglesMode: 'and',
			tanglesMinIn: 0,
			tanglesMinOut: 0,
		}));
		expect(entries.length).toBe(5);
	});
});

describe('computeTangles — sorting and limits', () => {
	test("sorts by in+out DESC, then in DESC, then path ASC", () => {
		// Three candidates tied on total=4, two also tied on in=2 → alphabetic.
		// Sources/targets are degree-1 nodes that fall below the sum=4 threshold.
		const mc = makeMetadataCache({
			// alpha: in=3 (s1,s2,s3), out=1 (t1) → total 4
			's1.md': { 'alpha.md': 1 },
			's2.md': { 'alpha.md': 1 },
			's3.md': { 'alpha.md': 1 },
			'alpha.md': { 't1.md': 1 },
			// beta: in=2 (s4,s5), out=2 (t1,t2) → total 4
			's4.md': { 'beta.md': 1 },
			's5.md': { 'beta.md': 1 },
			'beta.md': { 't1.md': 1, 't2.md': 1 },
			// gamma: in=2 (s6,s7), out=2 (t1,t2) → total 4, ties with beta on in
			's6.md': { 'gamma.md': 1 },
			's7.md': { 'gamma.md': 1 },
			'gamma.md': { 't1.md': 1, 't2.md': 1 },
		});
		const c = freshCollector(mc);
		[
			'alpha.md', 'beta.md', 'gamma.md',
			's1.md', 's2.md', 's3.md', 's4.md', 's5.md', 's6.md', 's7.md',
			't1.md', 't2.md',
		].forEach(p => c.update(p, bare()));

		const entries = computeTangles(c, makeSettings({
			tanglesMode: 'sum',
			tanglesMinTotal: 4,
		}));
		// alpha (in=3) before beta/gamma (in=2); beta < gamma alphabetically.
		expect(entries.map(e => e.path)).toEqual(['alpha.md', 'beta.md', 'gamma.md']);
	});

	test("tanglesTopN caps the result; 0 means unlimited", () => {
		const mc = makeMetadataCache({
			'a.md': { 'b.md': 1, 'c.md': 1, 'd.md': 1 },
			'b.md': { 'a.md': 1, 'c.md': 1, 'd.md': 1 },
			'c.md': { 'a.md': 1, 'b.md': 1, 'd.md': 1 },
			'd.md': { 'a.md': 1, 'b.md': 1, 'c.md': 1 },
		});
		const c = freshCollector(mc);
		['a.md', 'b.md', 'c.md', 'd.md'].forEach(p => c.update(p, bare()));

		const unlimited = computeTangles(c, makeSettings({ tanglesTopN: 0 }));
		expect(unlimited.length).toBe(4);

		const top2 = computeTangles(c, makeSettings({ tanglesTopN: 2 }));
		expect(top2.length).toBe(2);
	});

	test("limitOverride wins over persisted tanglesTopN", () => {
		const mc = makeMetadataCache({
			'a.md': { 'b.md': 1 },
			'b.md': { 'a.md': 1 },
			'c.md': { 'a.md': 1, 'b.md': 1 },
			'a2.md': { 'a.md': 1, 'b.md': 1 },
		});
		const c = freshCollector(mc);
		['a.md', 'b.md', 'c.md', 'a2.md'].forEach(p => c.update(p, bare()));

		// Persisted limit is 0 (unlimited); override caps to 1.
		const entries = computeTangles(c, makeSettings({ tanglesTopN: 0, tanglesMinIn: 1, tanglesMinOut: 1 }), 1);
		expect(entries.length).toBe(1);
	});
});

describe('computeTangles — invalidation across generation', () => {
	test("re-uses cached link valency within one generation, recomputes after bumpGeneration", () => {
		const links: Record<string, Record<string, number>> = {
			'src.md': { 'hub.md': 1 },
		};
		const mc = makeMetadataCache(links);
		const c = freshCollector(mc);
		c.update('src.md', bare());
		c.update('hub.md', bare());

		const first = computeTangles(c, makeSettings({ tanglesMinIn: 1, tanglesMinOut: 0 }));
		expect(first.map(e => e.path)).toEqual(['hub.md']);

		// Add a new outgoing link to hub. Without bumpGeneration the
		// memoized valency map is stale and hub still looks out=0.
		links['hub.md'] = { 'src.md': 1 };
		const stale = computeTangles(c, makeSettings({ tanglesMinIn: 1, tanglesMinOut: 1 }));
		expect(stale.length).toBe(0);

		c.bumpGeneration();
		const fresh = computeTangles(c, makeSettings({ tanglesMinIn: 1, tanglesMinOut: 1 }));
		// After the new link, hub gets out=1 and src gets in=1 — both pass.
		// Tie-break (total=2, in=1) falls through to path ASC: hub < src.
		expect(fresh.map(e => e.path)).toEqual(['hub.md', 'src.md']);
	});
});

describe('computeTangles — exclusion list', () => {
	function setup() {
		const mc = makeMetadataCache({
			'Personal/Me.md': { 'Daily/2026-01-01.md': 1, 'Daily/2026-01-02.md': 1 },
			'Daily/2026-01-01.md': { 'Personal/Me.md': 1 },
			'Daily/2026-01-02.md': { 'Personal/Me.md': 1 },
			'hub.md': { 'a.md': 1, 'b.md': 1 },
			'a.md': { 'hub.md': 1 },
			'b.md': { 'hub.md': 1 },
		});
		const c = freshCollector(mc);
		[
			'Personal/Me.md', 'Daily/2026-01-01.md', 'Daily/2026-01-02.md',
			'hub.md', 'a.md', 'b.md',
		].forEach(p => c.update(p, bare()));
		return c;
	}

	test("exact-path exclusion removes a single note", () => {
		const c = setup();
		const entries = computeTangles(c, makeSettings({
			tanglesMode: 'and',
			tanglesMinIn: 2,
			tanglesMinOut: 2,
			tanglesExclude: ['Personal/Me.md'],
		}));
		expect(entries.map(e => e.path)).toEqual(['hub.md']);
	});

	test("folder-prefix exclusion removes every note under that folder", () => {
		const c = setup();
		// Without exclusion every linked note would be a tangle at min=1.
		const all = computeTangles(c, makeSettings({
			tanglesMode: 'and',
			tanglesMinIn: 1,
			tanglesMinOut: 1,
		}));
		expect(all.map(e => e.path).sort()).toEqual([
			'Daily/2026-01-01.md', 'Daily/2026-01-02.md',
			'Personal/Me.md', 'a.md', 'b.md', 'hub.md',
		]);

		const filtered = computeTangles(c, makeSettings({
			tanglesMode: 'and',
			tanglesMinIn: 1,
			tanglesMinOut: 1,
			tanglesExclude: ['Daily'],
		}));
		expect(filtered.map(e => e.path).sort()).toEqual([
			'Personal/Me.md', 'a.md', 'b.md', 'hub.md',
		]);
	});

	test("trailing slashes and whitespace in exclude entries are normalized", () => {
		const c = setup();
		const filtered = computeTangles(c, makeSettings({
			tanglesMode: 'and',
			tanglesMinIn: 1,
			tanglesMinOut: 1,
			tanglesExclude: ['  Daily/  ', '', 'Personal/Me.md/'],
		}));
		expect(filtered.map(e => e.path).sort()).toEqual(['a.md', 'b.md', 'hub.md']);
	});

	test("prefix without trailing slash does NOT match a sibling folder with the same stem", () => {
		const mc = makeMetadataCache({
			'Daily/a.md': { 'x.md': 1 },
			'x.md': { 'Daily/a.md': 1, 'DailyArchive/b.md': 1 },
			'DailyArchive/b.md': { 'x.md': 1 },
		});
		const c = freshCollector(mc);
		['Daily/a.md', 'DailyArchive/b.md', 'x.md'].forEach(p => c.update(p, bare()));

		const filtered = computeTangles(c, makeSettings({
			tanglesMode: 'and',
			tanglesMinIn: 1,
			tanglesMinOut: 1,
			tanglesExclude: ['Daily'],
		}));
		// `Daily/a.md` is excluded; `DailyArchive/b.md` survives because the
		// prefix is matched with a trailing slash, not by raw startsWith.
		expect(filtered.map(e => e.path).sort()).toEqual(['DailyArchive/b.md', 'x.md']);
	});
});

describe('renderTanglesReport', () => {
	const fixedDate = new Date(2026, 4, 12, 14, 30); // 2026-05-12 14:30 local

	test("renders header, meta and a table row per entry", () => {
		const settings: TanglesSettings = {
			tanglesMode: 'and',
			tanglesMinIn: 2,
			tanglesMinOut: 2,
			tanglesMinTotal: 4,
			tanglesTopN: 0,
			tanglesExclude: [],
		};
		const md = renderTanglesReport([
			{ path: 'Notes/hub.md', inCount: 5, outCount: 4 },
		], settings, fixedDate);

		expect(md).toContain('# Vault Tangles — 2026-05-12 14-30');
		expect(md).toContain('- Mode: `and` · in ≥ 2 AND out ≥ 2');
		expect(md).toContain('- Total tangles: 1');
		expect(md).toContain('| 5 | 4 | [[Notes/hub]] |');
	});

	test("renders an empty-state notice when there are no entries", () => {
		const settings: TanglesSettings = {
			tanglesMode: 'sum',
			tanglesMinIn: 1,
			tanglesMinOut: 1,
			tanglesMinTotal: 99,
			tanglesTopN: 10,
			tanglesExclude: [],
		};
		const md = renderTanglesReport([], settings, fixedDate);
		expect(md).toContain('- Total tangles: 0');
		expect(md).toContain('_No notes match the current tangle thresholds._');
		expect(md).not.toContain('| In | Out | Note |');
	});

	test("sum mode shows the combined threshold in the header", () => {
		const settings: TanglesSettings = {
			tanglesMode: 'sum',
			tanglesMinIn: 0,
			tanglesMinOut: 0,
			tanglesMinTotal: 7,
			tanglesTopN: 0,
			tanglesExclude: [],
		};
		const md = renderTanglesReport([{ path: 'a.md', inCount: 4, outCount: 4 }], settings, fixedDate);
		expect(md).toContain('- Mode: `sum` · in+out ≥ 7');
	});
});

describe('wikilinkTargetForPath', () => {
	test("strips the .md extension from a path", () => {
		expect(wikilinkTargetForPath('folder/Note.md')).toBe('folder/Note');
	});

	test("leaves a non-.md path unchanged", () => {
		expect(wikilinkTargetForPath('folder/Note')).toBe('folder/Note');
	});
});
