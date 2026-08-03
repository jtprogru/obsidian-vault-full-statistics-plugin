import { getLanguage } from 'obsidian';

import { en } from './locales/en';
import { ru } from './locales/ru';
import { setFormatLocale } from './format';
import type { Translations } from './types';

/** Locales the catalogue actually speaks. Anything else falls back to English. */
export type UiLocale = 'en' | 'ru';

/**
 * The `language` setting. `'auto'` follows Obsidian's interface language and is
 * opt-in: the default is `'en'`, so updating the plugin never changes the
 * interface of someone who did not ask for it.
 */
export type LanguageSetting = 'auto' | UiLocale;

let active: Translations = en;

/**
 * Obsidian exposes `getLanguage()` from 1.8.7 and the plugin requires 1.13.1,
 * so this is available in practice. The guard costs nothing and keeps the
 * plugin from dying on an unexpected build.
 */
export function detectLanguage(): string {
	return typeof getLanguage === 'function' ? getLanguage() : 'en';
}

/** Which catalogue a setting resolves to. */
export function resolveUiLocale(setting: LanguageSetting, raw: string = detectLanguage()): UiLocale {
	if (setting !== 'auto') return setting;
	return raw.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

/**
 * Which locale numbers are formatted in. Under `'auto'` this is the raw value
 * from Obsidian rather than the resolved UI locale: a German user reads English
 * text but should still see German digit grouping.
 */
export function resolveFormatLocale(setting: LanguageSetting, raw: string = detectLanguage()): string {
	if (setting !== 'auto') return setting;
	return raw || 'en';
}

/** Switches both catalogue and number formatting. */
export function setLocale(setting: LanguageSetting, raw: string = detectLanguage()): void {
	active = resolveUiLocale(setting, raw) === 'ru' ? ru : en;
	setFormatLocale(resolveFormatLocale(setting, raw));
}

/**
 * Strings are read through a call, never through a bare imported object: module
 * level constants would otherwise freeze on whichever locale was active at
 * import time. Same reason `STATUS_BAR_ITEMS` and friends become functions.
 */
export function t(): Translations {
	return active;
}
