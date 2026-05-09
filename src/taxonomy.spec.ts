import {
	findRareTags,
	findUnknownTags,
	isCanonical,
	normalizeCanonical,
} from './taxonomy';

describe("normalizeCanonical", () => {
	test("strips leading hash, lowercases, drops empties", () => {
		const set = normalizeCanonical(["#Thought", "  Book ", "", "#"]);
		expect([...set].sort()).toStrictEqual(["book", "thought"]);
	});
});

describe("isCanonical", () => {
	const canonical = normalizeCanonical(["thought", "journal", "confidence/high"]);

	test("matches exact entry", () => {
		expect(isCanonical("thought", canonical)).toBe(true);
		expect(isCanonical("#Thought", canonical)).toBe(true);
	});

	test("parent covers descendants", () => {
		expect(isCanonical("journal/daily", canonical)).toBe(true);
		expect(isCanonical("journal/weekly/recap", canonical)).toBe(true);
	});

	test("specific entry does NOT cover bare parent", () => {
		expect(isCanonical("confidence", canonical)).toBe(false);
	});

	test("specific entry covers its own descendants", () => {
		expect(isCanonical("confidence/high/strong", canonical)).toBe(true);
	});

	test("unknown tag is not canonical", () => {
		expect(isCanonical("randomstuff", canonical)).toBe(false);
	});

	test("partial-name overlap is not a match", () => {
		// "journals" must NOT inherit from canonical "journal".
		expect(isCanonical("journals", canonical)).toBe(false);
	});
});

describe("findRareTags", () => {
	test("returns tags below threshold sorted by count desc, then name asc", () => {
		const occ = { foo: 1, bar: 2, baz: 5, qux: 1 };
		expect(findRareTags(occ, 3)).toStrictEqual([
			{ tag: "bar", count: 2 },
			{ tag: "foo", count: 1 },
			{ tag: "qux", count: 1 },
		]);
	});

	test("threshold of 1 yields only zero-count tags (none in practice)", () => {
		expect(findRareTags({ a: 1, b: 2 }, 1)).toStrictEqual([]);
	});

	test("normalizes hash prefix in input keys", () => {
		expect(findRareTags({ "#Foo": 1 }, 3)).toStrictEqual([{ tag: "foo", count: 1 }]);
	});
});

describe("findUnknownTags", () => {
	test("excludes canonical and their descendants", () => {
		const canonical = normalizeCanonical(["thought", "journal"]);
		const occ = { thought: 50, "journal/daily": 30, randomstuff: 4, typo: 1 };
		expect(findUnknownTags(occ, canonical)).toStrictEqual([
			{ tag: "randomstuff", count: 4 },
			{ tag: "typo", count: 1 },
		]);
	});

	test("empty canonical returns empty (feature off)", () => {
		expect(findUnknownTags({ anything: 5 }, new Set())).toStrictEqual([]);
	});

	test("sorts by count desc then name asc", () => {
		const canonical = normalizeCanonical(["k"]);
		const occ = { aa: 5, bb: 5, cc: 10 };
		expect(findUnknownTags(occ, canonical)).toStrictEqual([
			{ tag: "cc", count: 10 },
			{ tag: "aa", count: 5 },
			{ tag: "bb", count: 5 },
		]);
	});
});
