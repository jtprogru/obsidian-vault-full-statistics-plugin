import { en } from './locales/en';

/**
 * The shape every locale has to satisfy, inferred from the English catalogue.
 * A key missing from `ru.ts` is a compile error, an unknown key is an
 * excess-property error, and interpolation helpers keep their signatures.
 */
export type Translations = typeof en;
