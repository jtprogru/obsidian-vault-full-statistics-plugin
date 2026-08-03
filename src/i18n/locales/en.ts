/**
 * The English catalogue is the source of truth: `Translations` is derived from
 * it, so every other locale is checked against this shape at compile time.
 *
 * Deliberately **not** `as const`. With `as const` every value would get a
 * literal type — `notes: 'notes'` rather than `notes: string` — and `ru.ts`
 * would fail to compile on its first translated line with
 * `TS2322: Type '"заметок"' is not assignable to type '"notes"'`. A plain
 * object literal still gives us everything we need: a missing key is a compile
 * error, an extra key is an excess-property error, and function signatures are
 * checked as usual. Literal types are not wanted here — the stable identifiers
 * that end up in CSS classes and settings keys live in `ToggleItem.id`, never
 * in a locale catalogue.
 *
 * Sections are filled in as call sites are converted; the skeleton is here so
 * that the shape of the catalogue is visible from the start.
 */
export const en = {
	commands: {},
	statusBar: {},
	settings: {
		/**
		 * Inline counts on page entries. These are three separate functions
		 * rather than one `count(n, noun)` helper on purpose: Russian needs
		 * three plural forms *and* agreement in gender, so a shared helper
		 * taking a noun cannot work — «нет папок» / «1 папка» but «нет групп» /
		 * «1 группа».
		 */
		folderCount: (n: number) => n === 0 ? "No folders" : `${n} folder${n === 1 ? "" : "s"}`,
		groupCount: (n: number) => n === 0 ? "No groups" : `${n} group${n === 1 ? "" : "s"}`,
		canonicalTagCount: (n: number) =>
			n === 0 ? "No canonical tags" : `${n} canonical tag${n === 1 ? "" : "s"}`,
	},
	view: {},
	tangles: {},
	inbox: {},
	pickers: {},
	notices: {},
};
