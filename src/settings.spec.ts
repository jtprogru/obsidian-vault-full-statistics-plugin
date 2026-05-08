import { parseFolderGroups, serializeFolderGroups } from './settings';

describe("parseFolderGroups", () => {
	test("parses a single group with one path", () => {
		expect(parseFolderGroups("Projects = 01. Проекты")).toEqual([
			{ name: "Projects", paths: ["01. Проекты"] },
		]);
	});

	test("parses multiple groups", () => {
		const text = `Projects = 01. Проекты
Areas = 02. Сферы
Resources = 03. Ресурсы`;
		expect(parseFolderGroups(text)).toEqual([
			{ name: "Projects", paths: ["01. Проекты"] },
			{ name: "Areas", paths: ["02. Сферы"] },
			{ name: "Resources", paths: ["03. Ресурсы"] },
		]);
	});

	test("parses comma-separated paths within a group", () => {
		expect(parseFolderGroups("Notes = a, b, c")).toEqual([
			{ name: "Notes", paths: ["a", "b", "c"] },
		]);
	});

	test("trims whitespace and strips trailing slashes from paths", () => {
		expect(parseFolderGroups("  Spaces  =  foo/  ,  bar/baz/  ")).toEqual([
			{ name: "Spaces", paths: ["foo", "bar/baz"] },
		]);
	});

	test("skips empty lines and comments", () => {
		const text = `# this is a header
Projects = a

# another comment
Archive = b`;
		expect(parseFolderGroups(text)).toEqual([
			{ name: "Projects", paths: ["a"] },
			{ name: "Archive", paths: ["b"] },
		]);
	});

	test("ignores lines without =", () => {
		expect(parseFolderGroups("just a folder name\nProjects = a")).toEqual([
			{ name: "Projects", paths: ["a"] },
		]);
	});

	test("ignores groups with no name or no paths", () => {
		const text = `= some path
Empty =
Real = path`;
		expect(parseFolderGroups(text)).toEqual([
			{ name: "Real", paths: ["path"] },
		]);
	});

	test("preserves group order", () => {
		const text = `Z = z
A = a
M = m`;
		expect(parseFolderGroups(text).map(g => g.name)).toEqual(["Z", "A", "M"]);
	});
});

describe("serializeFolderGroups", () => {
	test("round-trips through parseFolderGroups", () => {
		const groups = [
			{ name: "Projects", paths: ["01. Проекты", "_Системные/Проекты"] },
			{ name: "Areas", paths: ["02. Сферы"] },
		];
		expect(parseFolderGroups(serializeFolderGroups(groups))).toEqual(groups);
	});

	test("empty groups serialize to empty string", () => {
		expect(serializeFolderGroups([])).toBe("");
	});
});
