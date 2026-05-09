import { UNIT_TOKENIZER, countWords } from './text';
import { BytesFormatter, DecimalUnitFormatter } from './format';
import { FullVaultMetrics } from './metrics';

describe("Unit tokenize", () => {
	test("always returns empty array", () => {
		expect(UNIT_TOKENIZER.tokenize("")).toStrictEqual([]);
		expect(UNIT_TOKENIZER.tokenize("foo bar baz")).toStrictEqual([]);
		expect(UNIT_TOKENIZER.tokenize("12345")).toStrictEqual([]);
	});
});

describe("countWords", () => {
	test("empty input is zero", () => {
		expect(countWords("")).toBe(0);
		expect(countWords("   \n\n  ")).toBe(0);
	});

	test("plain English prose", () => {
		expect(countWords("Hello world, this is a test.")).toBe(6);
	});

	test("contractions and hyphens count as one word each", () => {
		expect(countWords("We're going to the well-known place.")).toBe(6);
	});

	test("Cyrillic prose with hyphens", () => {
		expect(countWords("Привет мир, это по-русски.")).toBe(4);
	});

	test("numbers count as words", () => {
		expect(countWords("There are 42 cats and 7 dogs.")).toBe(7);
	});

	test("each CJK character counts as one word", () => {
		expect(countWords("你好世界")).toBe(4);
		expect(countWords("Hello 世界")).toBe(3);
	});

	test("strips frontmatter at file start", () => {
		const md = "---\ntags: [a, b]\ntitle: Foo\n---\nHello world";
		expect(countWords(md)).toBe(2);
	});

	test("excludes fenced code blocks", () => {
		const md = "Some prose.\n\n```js\nconst x = 1; const y = 2;\n```\n\nMore prose.";
		expect(countWords(md)).toBe(4);
	});

	test("excludes inline code", () => {
		expect(countWords("Use `npm install` to set up.")).toBe(4);
	});

	test("wikilinks count their alias when present", () => {
		expect(countWords("See [[Note Title|the docs]] for info.")).toBe(5);
	});

	test("wikilinks count target name when no alias", () => {
		expect(countWords("See [[Some Note]] today.")).toBe(4);
	});

	test("markdown links keep visible text only", () => {
		expect(countWords("Visit [our site](https://example.com/path) now.")).toBe(4);
	});

	test("image embeds are skipped", () => {
		expect(countWords("![[diagram.png]] caption text")).toBe(2);
		expect(countWords("![alt text](img.png) more")).toBe(1);
	});

	test("mixed-language paragraph", () => {
		const md = "Today I read 3 chapters and wrote по-русски — 你好.";
		// "Today"(1) "I"(2) "read"(3) "3"(4) "chapters"(5) "and"(6) "wrote"(7)
		// "по-русски"(8) + 你(9) 好(10)
		expect(countWords(md)).toBe(10);
	});
});

describe("Bytes formatter", () => {
	const fmt = new BytesFormatter();
	test("formats bytes < 1KB", () => {
		expect(fmt.format(512)).toBe("512.00 bytes");
	});
	test("formats KB", () => {
		expect(fmt.format(2048)).toBe("2.00 KB");
	});
	test("formats MB", () => {
		expect(fmt.format(1048576)).toBe("1.00 MB");
	});
	test("formats GB", () => {
		expect(fmt.format(1073741824)).toBe("1.00 GB");
	});
});

describe("Decimal unit formatter", () => {
	const fmt = new DecimalUnitFormatter("notes");
	test("formats integer", () => {
		expect(fmt.format(1234)).toBe("1,234 notes");
	});
	test("formats zero", () => {
		expect(fmt.format(0)).toBe("0 notes");
	});
	test("formats negative", () => {
		expect(fmt.format(-42)).toBe("-42 notes");
	});
});

describe("Full vault metrics", () => {
	test("reset sets all to zero except quality", () => {
		const m = new FullVaultMetrics();
		m.notes = 2; m.links = 10; m.quality = 42;
		m.reset();
		expect(m.notes).toBe(0);
		expect(m.links).toBe(0);
		expect(m.quality).toBeCloseTo(0.00001);
	});
	test("inc and dec update values", () => {
		const m = new FullVaultMetrics();
		const delta = new FullVaultMetrics();
		delta.notes = 2;
		delta.links = 5;
		delta.quality = 0;
		m.inc(delta);
		expect(m.notes).toBe(2);
		expect(m.links).toBe(5);
		m.dec(delta);
		expect(m.notes).toBe(0);
		expect(m.links).toBe(0);
	});
});
