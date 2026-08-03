import { setLocale } from '../i18n';

/**
 * Every suite starts in English. Without this a test that switches the locale
 * would leak into whatever runs after it inside the same worker, and the
 * existing specs assert on English strings throughout.
 */
beforeEach(() => {
	setLocale('en', 'en');
});
