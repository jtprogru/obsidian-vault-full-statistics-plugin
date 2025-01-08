import { markdown_tokenize } from './text';

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
		expect(markdown_tokenize("Lorem ipsum dolor sit amet, consectetur adipiscing elit. \
Curabitur facilisis iaculis turpis eu viverra. Donec rhoncus sit amet velit vel euismod. \
Aenean eros orci, tincidunt a odio sed, pellentesque mattis magna. Praesent id turpis \
placerat, scelerisque sapien pharetra, suscipit erat. Quisque sed consectetur diam, \
fermentum volutpat dolor. Suspendisse et dictum tellus, in laoreet nisi. Sed nec porta \
felis. Morbi ultrices metus non metus facilisis mollis. Proin id finibus velit, in \
blandit nulla. Vivamus id posuere dui.")).
			toStrictEqual([
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
