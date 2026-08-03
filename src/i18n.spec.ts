import { setLocale, resolveUiLocale, resolveFormatLocale, t } from './i18n';
import { plural } from './i18n/plural';
import { numberFormat, compactFormat, getFormatLocale } from './i18n/format';
import { en } from './i18n/locales/en';
import { ru } from './i18n/locales/ru';
import { DEFAULT_SETTINGS } from './settings';

describe("plural", () => {
	const folders = (n: number) => plural(n, "папка", "папки", "папок");

	test("one form covers 1, 21, 31", () => {
		expect(folders(1)).toBe("папка");
		expect(folders(21)).toBe("папка");
		expect(folders(101)).toBe("папка");
	});

	test("few form covers 2-4 and 22-24", () => {
		expect(folders(2)).toBe("папки");
		expect(folders(4)).toBe("папки");
		expect(folders(22)).toBe("папки");
	});

	test("many form covers 0, 5-20 and the teens", () => {
		expect(folders(0)).toBe("папок");
		expect(folders(5)).toBe("папок");
		expect(folders(11)).toBe("папок");
		expect(folders(14)).toBe("папок");
		expect(folders(111)).toBe("папок");
	});
});

describe("resolveUiLocale", () => {
	test("auto follows Obsidian for Russian", () => {
		expect(resolveUiLocale('auto', 'ru')).toBe('ru');
		expect(resolveUiLocale('auto', 'ru-RU')).toBe('ru');
		expect(resolveUiLocale('auto', 'RU')).toBe('ru');
	});

	test("auto falls back to English for everything else", () => {
		expect(resolveUiLocale('auto', 'en')).toBe('en');
		expect(resolveUiLocale('auto', 'de')).toBe('en');
		expect(resolveUiLocale('auto', 'pt-BR')).toBe('en');
		expect(resolveUiLocale('auto', '')).toBe('en');
	});

	test("an explicit setting wins over Obsidian's language", () => {
		expect(resolveUiLocale('en', 'ru')).toBe('en');
		expect(resolveUiLocale('ru', 'en')).toBe('ru');
	});
});

describe("resolveFormatLocale", () => {
	// A German user reads English text but should see German digit grouping,
	// so under 'auto' the raw language is passed through rather than the
	// resolved UI locale.
	test("auto passes Obsidian's language through verbatim", () => {
		expect(resolveFormatLocale('auto', 'de')).toBe('de');
		expect(resolveFormatLocale('auto', 'pt-BR')).toBe('pt-BR');
	});

	test("an explicit setting formats in that language", () => {
		expect(resolveFormatLocale('ru', 'de')).toBe('ru');
		expect(resolveFormatLocale('en', 'ru')).toBe('en');
	});

	test("an empty language never reaches Intl", () => {
		expect(resolveFormatLocale('auto', '')).toBe('en');
	});
});

describe("language default", () => {
	// Guards the product decision from §6 of the plan: updating the plugin must
	// not switch anybody's interface on its own. Auto-detection is opt-in.
	test("ships as English", () => {
		expect(DEFAULT_SETTINGS.language).toBe('en');
	});

	test("a Russian Obsidian stays English until the user asks", () => {
		setLocale(DEFAULT_SETTINGS.language, 'ru');
		expect(t()).toBe(en);

		setLocale('auto', 'ru');
		expect(t()).toBe(ru);
	});
});

describe("setLocale", () => {
	test("switches the catalogue", () => {
		setLocale('ru');
		expect(t()).toBe(ru);
		setLocale('en');
		expect(t()).toBe(en);
	});

	test("drops cached formatters so grouping follows the new locale", () => {
		setLocale('en');
		const beforeFmt = numberFormat();
		expect(beforeFmt.format(1234567)).toBe("1,234,567");

		setLocale('ru');
		expect(getFormatLocale()).toBe('ru');
		// Russian groups with a non-breaking space (U+00A0), not a plain one.
		expect(numberFormat().format(1234567)).toBe("1\u00A0234\u00A0567");
		expect(numberFormat()).not.toBe(beforeFmt);
	});
});

describe("compactFormat", () => {
	// Note the U+00A0 before «тыс.» — Russian compact notation separates the
	// suffix with a non-breaking space, and a plain one here would not match.
	test("follows the active locale by default", () => {
		setLocale('ru');
		expect(compactFormat().format(12345)).toBe("12,35\u00A0тыс.");
	});

	// The contract behind the "keep hero labels in English" setting: a narrow
	// panel can ask for the Latin form while the rest of the UI stays Russian.
	test("honours an explicit locale argument", () => {
		setLocale('ru');
		expect(compactFormat('en-US').format(12345)).toBe("12.35K");
	});
});

describe("catalogue parity", () => {
	type Node = Record<string, unknown>;

	function walk(a: Node, b: Node, path: string, report: string[]): void {
		for (const key of Object.keys(a)) {
			const here = path ? `${path}.${key}` : key;
			if (!(key in b)) {
				report.push(`missing in ru: ${here}`);
				continue;
			}
			const left = a[key];
			const right = b[key];
			if (typeof left !== typeof right) {
				report.push(`type differs at ${here}: ${typeof left} vs ${typeof right}`);
				continue;
			}
			if (typeof left === 'function' && typeof right === 'function') {
				if (left.length !== right.length) {
					report.push(`arity differs at ${here}: ${left.length} vs ${right.length}`);
				}
				continue;
			}
			if (left && typeof left === 'object') {
				walk(left as Node, right as Node, here, report);
			}
		}
		for (const key of Object.keys(b)) {
			if (!(key in a)) report.push(`extra in ru: ${path ? `${path}.${key}` : key}`);
		}
	}

	// tsc already rejects a missing or misspelled key. This covers what the
	// type system does not: interpolation helpers that quietly take a
	// different number of arguments in one locale.
	test("ru matches en key for key, including function arity", () => {
		const report: string[] = [];
		walk(en as unknown as Node, ru as unknown as Node, '', report);
		expect(report).toStrictEqual([]);
	});
});
