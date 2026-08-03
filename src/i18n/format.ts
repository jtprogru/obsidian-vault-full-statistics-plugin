/**
 * Locale-aware number formatting.
 *
 * This module owns the *formatting* locale, which is a separate notion from the
 * UI locale in `i18n/index.ts`: the catalogue only speaks 'en' and 'ru', while
 * formatting follows whatever Obsidian reports. A German user gets English text
 * and German digit grouping, which is the correct outcome rather than a bug.
 *
 * State lives here, not in the index, so that `index.ts` can drive this module
 * without the two importing each other.
 *
 * `Intl.NumberFormat` construction is not cheap and `appendSparkRow` formats
 * once per bar, so instances are cached and dropped whenever the locale
 * changes. Caching inside a module is fine; capturing a formatter in a
 * long-lived object's constructor is not — it would freeze on the locale that
 * was active at `onload`.
 */
let formatLocale = 'en';

const decimalCache = new Map<string, Intl.NumberFormat>();
const fractionCache = new Map<string, Intl.NumberFormat>();
const compactCache = new Map<string, Intl.NumberFormat>();

/** Called by {@link setLocale}; drops every cached formatter. */
export function setFormatLocale(locale: string): void {
	formatLocale = locale;
	decimalCache.clear();
	fractionCache.clear();
	compactCache.clear();
}

export function getFormatLocale(): string {
	return formatLocale;
}

/** Grouped integers — replaces the hardcoded `toLocaleString('en-US')` calls. */
export function numberFormat(locale: string = formatLocale): Intl.NumberFormat {
	let fmt = decimalCache.get(locale);
	if (!fmt) {
		fmt = new Intl.NumberFormat(locale, { style: 'decimal' });
		decimalCache.set(locale, fmt);
	}
	return fmt;
}

/** One-to-two fraction digits, for word counts below the compact threshold. */
export function fractionFormat(locale: string = formatLocale): Intl.NumberFormat {
	let fmt = fractionCache.get(locale);
	if (!fmt) {
		fmt = new Intl.NumberFormat(locale, {
			minimumFractionDigits: 1,
			maximumFractionDigits: 2,
		});
		fractionCache.set(locale, fmt);
	}
	return fmt;
}

/**
 * The one way percentages are written.
 *
 * Deliberately not `Intl.NumberFormat` with `style: 'percent'`: CLDR puts a
 * non-breaking space before the sign in Russian («67 %»), while the panel has
 * always written it tight («67%»). Two spellings of the same number in one
 * interface is worse than deviating from CLDR, and Russian typographic
 * convention wants it tight anyway. Only the grouping follows the locale.
 */
export function percentString(v: number): string {
	return `${numberFormat().format(Math.round(v * 100))}%`;
}

/**
 * Compact notation for the hero tile: `12.345K` in English, «12,35 тыс.» in
 * Russian. The explicit `locale` argument is what the "keep hero labels in
 * English" setting passes when the panel is too narrow for the Russian form.
 */
export function compactFormat(locale: string = formatLocale): Intl.NumberFormat {
	let fmt = compactCache.get(locale);
	if (!fmt) {
		fmt = new Intl.NumberFormat(locale, {
			notation: 'compact',
			minimumFractionDigits: 1,
			maximumFractionDigits: 2,
		});
		compactCache.set(locale, fmt);
	}
	return fmt;
}
