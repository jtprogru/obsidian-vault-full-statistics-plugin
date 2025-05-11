import { markdown_tokenize, unit_tokenize } from './text';
import { BytesFormatter, DecimalUnitFormatter } from './format';
import { FullVaultMetrics } from './metrics';

describe("base cases", () => {
	test("empty string yields empty set", () => {
		expect(markdown_tokenize("")).toStrictEqual([]);
	});

	test("single word content yields single english element", () => {
		expect(markdown_tokenize("foo")).toStrictEqual(["foo"]);
	});

	test("single word content yields single cyrillic element", () => {
		expect(markdown_tokenize("это")).toStrictEqual(["это"]);
	});
});

describe("word boundaries", () => {
	test("\\s", () => {
		expect(markdown_tokenize("foo bar baz")).toStrictEqual(["foo", "bar", "baz"]);
	});

	test("\\s", () => {
		expect(markdown_tokenize("это мир ваш")).toStrictEqual(["это", "мир", "ваш"]);
	});

	test("\\n", () => {
		expect(markdown_tokenize("foo\nbar\nbaz")).toStrictEqual(["foo", "bar", "baz"]);
	});

	test("\\n", () => {
		expect(markdown_tokenize("это\nмир\nваш")).toStrictEqual(["это", "мир", "ваш"]);
	});

	test("\\r", () => {
		expect(markdown_tokenize("foo\rbar\rbaz")).toStrictEqual(["foo", "bar", "baz"]);
	});

	test("\\t", () => {
		expect(markdown_tokenize("foo\tbar\tbaz")).toStrictEqual(["foo", "bar", "baz"]);
	});

	test("\"", () => {
		expect(markdown_tokenize("foo \"bar\" baz")).toStrictEqual(["foo", "bar", "baz"]);
	});

	test("|", () => {
		expect(markdown_tokenize("foo|bar|baz")).toStrictEqual(["foo", "bar", "baz"]);
	});

	test(",", () => {
		expect(markdown_tokenize("foo,bar,baz")).toStrictEqual(["foo", "bar", "baz"]);
	});

	test("( and )", () => {
		expect(markdown_tokenize("foo(bar)baz")).toStrictEqual(["foo", "bar", "baz"]);
	});

	test("[ and ]", () => {
		expect(markdown_tokenize("foo[bar]baz")).toStrictEqual(["foo", "bar", "baz"]);
	});

	test("/", () => {
		expect(markdown_tokenize("foo/bar")).toStrictEqual(["foo", "bar"]);
	});
});

describe("punctuation handling", () => {
	test("strips punctuation characters", () => {
		expect(markdown_tokenize("foo\nbar\nbaz")).toStrictEqual(["foo", "bar", "baz"]);
	});
});

describe("filtering", () => {
	test("non-words are removed", () => {
		const nonWords = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "`"];
		nonWords.forEach(nonWord => {
			expect(markdown_tokenize(nonWord)).toStrictEqual([]);
		});
	});

	test("numbers are not words", () => {
		const numbers = ["1", "123", "1231231"];
		numbers.forEach(number => {
			expect(markdown_tokenize(number)).toStrictEqual([]);
		});
	});

	test("code block headers", () => {
		const codeBlockHeaders = ["```", "```java", "```perl", "```python"];
		codeBlockHeaders.forEach(header => {
			expect(markdown_tokenize(header)).toStrictEqual([]);
		});
	});
});

describe("strip punctuation", () => {
	test("highlights", () => {
		expect(markdown_tokenize("==foo")).toStrictEqual(["foo"]);
		expect(markdown_tokenize("foo==")).toStrictEqual(["foo"]);
		expect(markdown_tokenize("==foo==")).toStrictEqual(["foo"]);
	});

	test("formatting", () => {
		const formats = ["*foo", "foo*", "*foo*", "**foo", "foo**", "**foo**", "__foo", "foo__", "__foo__"];
		formats.forEach(format => {
			expect(markdown_tokenize(format)).toStrictEqual(["foo"]);
		});
	});

	test("punctuation", () => {
		const punctuations = ["\"foo", "foo\"", "\"foo\"", "`foo", "foo`", "`foo`", "foo:", "foo.", "foo,", "foo?", "foo!"];
		punctuations.forEach(punctuation => {
			expect(markdown_tokenize(punctuation)).toStrictEqual(["foo"]);
		});
	});

	test("callouts", () => {
		expect(markdown_tokenize("[!foo]")).toStrictEqual(["foo"]);
		expect(markdown_tokenize("[!foo bar]")).toStrictEqual(["foo", "bar"]);
	});

	test("wiki links", () => {
		expect(markdown_tokenize("[[foo")).toStrictEqual(["foo"]);
		expect(markdown_tokenize("foo]]")).toStrictEqual(["foo"]);
		expect(markdown_tokenize("[[foo]]")).toStrictEqual(["foo"]);
	});

	test("combinations", () => {
		expect(markdown_tokenize("_**foo**_:]],:`.`")).toStrictEqual(["foo"]);
	});
});

describe("integration tests", () => {
	test("sentences", () => {
		expect(markdown_tokenize("Lorem ipsum dolor sit amet, consectetur adipiscing elit.")).
			toStrictEqual([
				"Lorem",
				"ipsum",
				"dolor",
				"sit",
				"amet",
				"consectetur",
				"adipiscing",
				"elit",
			]);
	});

	test("paragraphs", () => {
		expect(markdown_tokenize(
			"Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
			"Curabitur facilisis iaculis turpis eu viverra. Donec rhoncus sit amet velit vel euismod. " +
			"Aenean eros orci, tincidunt a odio sed, pellentesque mattis magna. Praesent id turpis " +
			"placerat, scelerisque sapien pharetra, suscipit erat. Quisque sed consectetur diam, " +
			"fermentum volutpat dolor. Suspendisse et dictum tellus, in laoreet nisi. Sed nec porta " +
			"felis. Morbi ultrices metus non metus facilisis mollis. Proin id finibus velit, in " +
			"blandit nulla. Vivamus id posuere dui."
		)).toStrictEqual([
			"Lorem",
			"ipsum",
			"dolor",
			"sit",
			"amet",
			"consectetur",
			"adipiscing",
			"elit",
			"Curabitur",
			"facilisis",
			"iaculis",
			"turpis",
			"eu",
			"viverra",
			"Donec",
			"rhoncus",
			"sit",
			"amet",
			"velit",
			"vel",
			"euismod",
			"Aenean",
			"eros",
			"orci",
			"tincidunt",
			"a",
			"odio",
			"sed",
			"pellentesque",
			"mattis",
			"magna",
			"Praesent",
			"id",
			"turpis",
			"placerat",
			"scelerisque",
			"sapien",
			"pharetra",
			"suscipit",
			"erat",
			"Quisque",
			"sed",
			"consectetur",
			"diam",
			"fermentum",
			"volutpat",
			"dolor",
			"Suspendisse",
			"et",
			"dictum",
			"tellus",
			"in",
			"laoreet",
			"nisi",
			"Sed",
			"nec",
			"porta",
			"felis",
			"Morbi",
			"ultrices",
			"metus",
			"non",
			"metus",
			"facilisis",
			"mollis",
			"Proin",
			"id",
			"finibus",
			"velit",
			"in",
			"blandit",
			"nulla",
			"Vivamus",
			"id",
			"posuere",
			"dui",
		]);
	});

	test("callouts", () => {
		expect(markdown_tokenize("> [!Lorem] Ipsum, dolor sit amet.")).
			toStrictEqual([
				"Lorem",
				"Ipsum",
				"dolor",
				"sit",
				"amet",
			]);
	});

	test("complex markdown", () => {
		expect(markdown_tokenize("**Bold** and _italic_ text with [link](http://example.com) and `code`."))
			.toStrictEqual(["Bold", "and", "italic", "text", "with", "link", "and", "code"]);
	});

	test("nested markdown", () => {
		expect(markdown_tokenize("**Bold _italic_** and `code` with [link](http://example.com)."))
			.toStrictEqual(["Bold", "italic", "and", "code", "with", "link"]);
	});

	test("markdown with emojis", () => {
		expect(markdown_tokenize("Hello :smile: world!"))
			.toStrictEqual(["Hello", "smile", "world"]);
	});
});

describe("unit_tokenize", () => {
	test("always returns empty array", () => {
		expect(unit_tokenize("")).toStrictEqual([]);
		expect(unit_tokenize("foo bar baz")).toStrictEqual([]);
		expect(unit_tokenize("12345")).toStrictEqual([]);
	});
});

describe("BytesFormatter", () => {
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

describe("DecimalUnitFormatter", () => {
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

describe("FullVaultMetrics", () => {
	test("reset sets all to zero except quality", () => {
		const m = new FullVaultMetrics();
		m.files = 5; m.notes = 2; m.attachments = 1; m.size = 100; m.links = 10; m.words = 50; m.quality = 42; m.tags = 3;
		m.reset();
		expect(m.files).toBe(0);
		expect(m.notes).toBe(0);
		expect(m.attachments).toBe(0);
		expect(m.size).toBe(0);
		expect(m.links).toBe(0);
		expect(m.words).toBe(0);
		expect(m.quality).toBeCloseTo(0.00001);
		expect(m.tags).toBe(0);
	});
	test("inc and dec update values", () => {
		const m = new FullVaultMetrics();
		const delta = new FullVaultMetrics();
		delta.files = 1;
		delta.notes = 2;
		delta.attachments = 3;
		delta.size = 4;
		delta.links = 5;
		delta.words = 6;
		delta.quality = 0;
		delta.tags = 7;
		m.inc(delta);
		expect(m.files).toBe(1);
		expect(m.notes).toBe(2);
		expect(m.attachments).toBe(3);
		expect(m.size).toBe(4);
		expect(m.links).toBe(5);
		expect(m.words).toBe(6);
		expect(m.tags).toBe(7);
		m.dec(delta);
		expect(m.files).toBe(0);
		expect(m.notes).toBe(0);
		expect(m.attachments).toBe(0);
		expect(m.size).toBe(0);
		expect(m.links).toBe(0);
		expect(m.words).toBe(0);
		expect(m.tags).toBe(0);
	});
});
