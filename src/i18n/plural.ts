/**
 * Russian plural forms, for use inside `locales/ru.ts`.
 *
 * Lives in its own module rather than in `i18n/index.ts` on purpose: the index
 * imports the locale catalogues, so a `plural` exported from there would make
 * `ru.ts` and `index.ts` import each other. Hoisting would paper over it, but
 * relying on ES module initialisation order to save a file is a bad trade.
 *
 * English forms are written inline in `en.ts` — a ternary is clearer there than
 * a helper.
 */
const RU_RULES = new Intl.PluralRules('ru');

/**
 * @param one   form for 1, 21, 31 — «1 папка»
 * @param few   form for 2–4, 22–24 — «2 папки»
 * @param many  form for 0, 5–20, 11–14 — «5 папок»
 */
export function plural(n: number, one: string, few: string, many: string): string {
	switch (RU_RULES.select(n)) {
		case 'one': return one;
		case 'few': return few;
		default: return many;
	}
}
