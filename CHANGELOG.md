# Changelog

All notable changes to this plugin are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Concept folders**, **Own folders** and **Source folders** settings (`Settings → What gets counted → Note classification`). Notes under a configured folder now count toward that classification even without the matching tag, for vaults that sort own/source/concept notes by location instead of tagging each one individually. Closes [#55](https://github.com/jtprogru/obsidian-vault-full-statistics-plugin/issues/55).

## [1.24.2] - 2026-08-11

A maintenance release. The build toolchain moved to TypeScript 7 and the rest of the dev dependencies were refreshed. Nothing the plugin ships or does changed — no source file was touched, and the linter rule set is identical to the previous one.

### Changed
- `typescript` upgraded 6.0.3 → 7.0.2. Neither of the two packages that blocked the major is left in the tree.
- `ts-jest` replaced with `@swc/jest`: it needs the JavaScript compiler API that TypeScript 7 no longer exposes. Type-checking of the specs is unaffected — they live under `src/`, which `tsc -noEmit` covers on the build step. Test runner is still Jest; the suite runs in roughly a third of the time.
- `eslint`, `typescript-eslint`, `@eslint/js` and `globals` replaced with `oxlint`: `typescript-eslint` refuses to run on TypeScript 7 and has no release supporting it ([typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)). `eslint.config.mjs` was ported one-for-one to `.oxlintrc.json`, keeping every rule and the spec/mocks overrides.
- Dev dependencies bumped to their latest patches: `@types/node` 26.1.2 → 26.2.0, `esbuild` 0.28.1 → 0.28.2, `oxlint` 1.77.0 → 1.78.0.
- The release workflow pins `actions/attest-build-provenance` 4.2.2 instead of 4.1.1.

## [1.24.1] - 2026-08-04

A maintenance release. The build toolchain picked up a newer `@types/node`; nothing the plugin ships or does changed.

### Changed
- Bumped the dev dependency `@types/node` to `^26.1.2`.

## [1.24.0] - 2026-08-03

Every editable list now carries its own name. On a page like **Inbox health** the label `Inbox folders` used to sit in a separate row above its list, and Obsidian packs consecutive plain rows into one card — so the label ended up sharing a card with the `Show inbox health` toggle while the folders it named lived in the next card down, past a lone `+` button. The name has moved into the list's own header, where it sits beside that `+` and directly above the entries it belongs to.

The explanation that used to ride along with the label now shows inside the list while the list is empty, which is when it is actually needed. Once you have added an entry, the list speaks for itself.

Nothing about what the plugin counts or stores changed, and no setting was renamed or given a new default.

### Changed
- **List names moved into the list header** on all eight editable lists: excluded folders, own/source/concept tags, canonical tags, inbox folders, inbox review tags, folder groups and the tangles exclusion list. `Excluded folders` is the one exception — it is the whole content of its own page, so the page title already names it and the header would only repeat it.
- **List descriptions moved into the empty state.** Each list explains what belongs in it while it holds nothing, then gets out of the way.

### Fixed
- The English catalogue carried Russian examples in three places — the inbox folder placeholder (`e.g. 00. Входящие`), the folder-groups placeholder and the folder-groups description. An English interface now shows English examples; the Russian catalogue keeps its own.

### Removed
- Search aliases for the four list labels that no longer have a row of their own (`ignore`, `skip`, `classification`, `zettelkasten`, `literature`). Obsidian's settings search indexes rows and page names, not list headers, so these had nowhere left to live. The pages holding them — **Excluded folders**, **Note classification** — are still found by name.

### Tests
- The list helpers in the settings spec look lists up by their header instead of by "the definition that follows this row", so the tests no longer encode the layout that was the problem.
- Three new guards: no plain row may exist without a control, a renderer or an action (the exact shape of the old label rows); every list except the standalone one carries a header; and a list's empty state repeats its description.

## [1.23.0] - 2026-08-03

The plugin speaks Russian. Every string in the interface — status bar, both side panels, all settings pages, notices, the tangles report and the inbox markdown — now comes from a locale catalogue, and numbers are formatted for the active language.

English remains the default. Updating the plugin changes nothing about what you see; Russian and follow-Obsidian are things you switch on yourself.

### Added
- **`Language` setting**: `English` (default), `Русский`, `Auto (follow Obsidian)`. Switching redraws the settings tab, both panels and the status bar immediately. Command names and the ribbon tooltip follow after a plugin reload — Obsidian caches those at registration — and a notice says so.
- **`Keep hero labels in English`**, shown only when the interface is not English. The three hero tiles keep their Latin labels and the `12.35K` compact format, which fit a narrow sidebar better than «заметок» / «слов» and «12,35 тыс.». Tooltips stay translated.
- Russian translation of all ~245 interface strings, with Russian plural forms («1 папка» / «3 папки» / «7 папок») and terminology that follows Obsidian's own Russian locale where it has a word for something.

### Changed
- Numbers, including those in the sparkline and the hero panel, are formatted for the active language: `1,234` in English, `1 234` in Russian. Under `Auto` the formatting follows Obsidian's language even where the plugin has no translation, so a German interface reads English but groups digits the German way.
- Percentages are written one way everywhere. The panel and the status bar used to compute them separately — identical in English, but Russian would have rendered the status bar as «67 %» with a non-breaking space while the panel kept «67%». Both are now tight.
- The tangles report note is created with a localised name and body; the CSV export keeps its English file name and column headers, since it is an interchange format and a renamed file would simply appear twice.
- Status bar statistics keep stable English identifiers in their CSS classes (`obsidian-vault-full-statistics--item-notes` and friends) regardless of language, so existing CSS snippets keep working.

### Removed
- `BytesFormatter` and `ScalingUnitFormatter`, unused in production since well before this release.

## [1.22.0] - 2026-08-03

The settings tab became an index. The first screen used to be one scroll of 28 rows (40 with individual status bar items on), mixing a lone toggle, two blocks of checkboxes and four editable lists with the four navigable pages added in 1.21.0. Now it holds one toggle and ten navigable entries under three headings, each entry summarising its own state.

### Changed
- **Settings are organised into pages.** Top level: `Show individual items` and `Status bar items`, then **What gets counted** (excluded folders, note classification), **Side view** (metrics, folder breakdown, sources with trace, taxonomy drift, inbox health, history) and **Tools** (tangles). No setting was removed, renamed or given a new default — everything moved one level down and is still reachable from `Settings → Search`.
- Every entry now carries a state summary: `11 of 12`, `3 own / 6 source`, `No folders`, `On + top 5`. Previously only four of them did.
- Two more configurations that silently render nothing are flagged with a warning marker: every status bar item turned off, and an empty own or source tag list (the own/source ratio, which the hero panel is built on, has no meaning then).
- The twelve status bar toggles and the five side view metric toggles are generated from one ordered list each. `StatusBarView` reads the same list to decide which statistics are enabled, so the settings tab and the status bar can no longer drift apart.
- **`minAppVersion` raised from 1.13.0 to 1.13.1.** `displayValue` and `status` on a settings page landed in 1.13.1, and 1.21.0 already shipped them — the manifest has been understating the requirement since that release.

### Fixed
- The per-statistic status bar toggles are no longer hidden when `Show individual items` is off. Cycling mode walks only the enabled statistics and skips the rest, so those toggles were doing their job the whole time while the settings tab claimed otherwise and hid them.

### Documentation
- README's settings reference follows the new hierarchy and describes the index-plus-pages layout.

## [1.21.0] - 2026-08-01

Settings are rebuilt on Obsidian 1.13's declarative settings API. The plugin's settings are now searchable from the settings panel, the long sections became navigable pages, and the tag/folder lists gained drag-to-reorder.

### Added
- Plugin settings appear in Obsidian's settings search. Typing "own tags", "tangles" or "inbox" in `Settings → Search` now finds the plugin's rows — previously the entire tab was invisible to search.
- Folder breakdown, Taxonomy drift, Inbox health and Tangles became navigable pages. Each shows its current state on the entry (`3 groups`, `AND ≥ 5/5`, `Off`) and flags configurations that silently render nothing: folder breakdown enabled with no groups, taxonomy drift with no canonical tags, inbox health with neither folders nor review tags.
- Every list (excluded folders, own/source/concept tags, canonical tags, inbox folders and review tags, folder groups, tangle exclusions) supports drag-to-reorder and Delete/Backspace removal.
- Excluded folders and inbox folders are added through the vault folder picker instead of a blank text row; the history export and tangles report folders use Obsidian's folder suggester.
- Numeric thresholds reject negatives and fractions with an inline error instead of silently snapping back to the default.

### Changed
- **`minAppVersion` raised from 1.7.2 to 1.13.0.** The declarative settings API does not exist on older builds. Obsidian withholds plugin updates from users on an older app version, so they stay on 1.20.2, which continues to work.
- The settings tab migrated from the deprecated `PluginSettingTab.display()` to `getSettingDefinitions()`. Obsidian 1.13.0 deprecated `display()`; it still renders as a fallback, but its rows never reach the settings search index.
- `DEFAULT_SETTINGS` moved from `main.ts` to `settings.ts` so the definitions can reference it, and `settings.ts` now imports `main.ts` as a type-only import, removing the runtime module cycle between them.
- `styles.css` dropped the overrides of Obsidian's internal `.setting-item` structure that the hand-rolled list editors needed. Core renders list rows now, so those rules were both dead and fragile against the 1.13 settings redesign.
- `tsconfig.json` no longer depends on `ignoreDeprecations`. `baseUrl` was unused — every import in `src/` is either relative or the bare `obsidian` package — so it is simply gone, and `moduleResolution` moves from the removed `node10` to `bundler`, which is what actually describes the esbuild pipeline. The previous config only compiled because `ignoreDeprecations: "6.0"` suppressed two options TypeScript had already removed; it fails outright on TypeScript 7, whereas the new config typechecks clean on both 6.0.3 and 7.0.2.

### Fixed
- `setControlValue` is overridden rather than inherited. The inherited implementation persists through the plugin's `saveData`, which would have written a bare settings object and dropped the 30-day history snapshots — this plugin stores `{settings, history}` as one payload.

### Tests
- 23 tests covering the settings tab, which was previously untestable below `parseFolderGroups` because everything lived inside `display()` and needed a DOM. They assert that all 41 settings reach the UI (32 bound controls, 9 list editors), that every control declares the shipped default, that visibility predicates and validators behave, and that list delete/reorder move the right entries and only rescan the vault when the value actually feeds the collector.

## [1.20.2] - 2026-06-28

Maintenance release: toolchain, dependency, and CI updates only — no changes to the plugin's runtime behavior.

### Changed
- Toolchain upgraded to current majors: TypeScript 5.9 → 6.0 (`tsconfig.json` updated with an explicit `rootDir` and `types`, and `ignoreDeprecations: "6.0"` for the `baseUrl`/`node10` module-resolution deprecations), Jest and `@types/jest` → 30, `@types/node` → 26, `esbuild` → 0.28, plus a grouped dev-dependencies bump.
- ESLint upgraded 8 → 10 and migrated from the legacy `.eslintrc`/`.eslintignore` to a flat `eslint.config.mjs` (built on `typescript-eslint`); all existing rules and the spec/mocks overrides are preserved.

### CI
- Workflows hardened: explicit least-privilege `permissions`, third-party actions pinned to commit SHAs, and a Dependabot config added for npm and GitHub Actions.
- GitHub Actions bumped: `actions/checkout` → 7, `softprops/action-gh-release` → 3.0.1.

### Documentation
- README gains a Privacy section documenting the plugin's no-network and read-only (no file mutation) guarantees.

## [1.20.1] - 2026-06-08

### Changed
- `styles.css`: `column-gap`/`row-gap` replaced with the `gap` shorthand in `.vfs-folder-list` and `.vfs-spark-grid` to silence the Obsidian plugin validator's multi-column warning.

### CI
- Release workflow now signs `main.js`, `styles.css`, and `manifest.json` with `actions/attest-build-provenance` so users can cryptographically verify release assets came from this repository.
- Release notes are auto-extracted from `CHANGELOG.md` for the published tag instead of being empty.

## [1.20.0] - 2026-06-06

### Added
- Status bar can now display the total word count of the vault. A new "Show words" toggle joins the existing per-metric toggles; it is on by default and shows up alongside notes/links/tags in the rotation. Closes #23.

## [1.19.0] - 2026-06-04

### Changed
- Plugin `onload` deferred behind `workspace.onLayoutReady` so Obsidian startup is not blocked by the initial vault scan.
- Backlog drain rewritten: interval is armed once at the end of `rescan()` instead of being reset per file; `update()` no longer auto-refreshes the tag count — callers refresh once per batch.
- `computeOrphanCount` and `computeSourcesTrace` (full `resolvedLinks` graph walks) gated behind a backlog-size threshold so they only run as the initial scan converges.
- Scanner uses `requestIdleCallback` for large backlogs (falls back to `setTimeout` for small live-edit backlogs) with an in-flight guard against re-entrant ticks.
- `rescan()` now uses `getMarkdownFiles()` instead of `getFiles()` — attachments were being collected and discarded.
- First refresh of the status bar and sidebar view runs immediately on load instead of waiting for the debounce window.

### Performance
- Plugin `onload` cut from ~1385 ms to ~2 ms on a 6k-note vault; total Obsidian startup from ~4.5 s to ~2.1 s; no more UI freeze during the initial scan.

## [1.16.3] - 2026-05-13

### Changed
- `jest.config.js`: `ts-jest` configuration moved from deprecated `globals['ts-jest']` to the `transform` tuple form.
- `tsconfig.json`: `esModuleInterop` enabled to silence ts-jest TS151001 hints.

## [1.16.2] - 2026-05-13

### Fixed
- CI test job: `src/__mocks__/obsidian.ts` is now tracked in git so jest can resolve the `obsidian` module mock on fresh clones.

## [1.16.1] - 2026-05-13

### Changed
- `minAppVersion` raised to `0.16.0` in manifest per scorecard recommendation.

## [1.16.0] - 2026-05-13

### Changed
- TypeScript `strict: true` enabled across the codebase (was `strictNullChecks` only).
- Dependencies bumped: `typescript` 4.7.4 → 5.x, `@types/node` 16 → 20, `@typescript-eslint/*` 5 → 7.
- ESLint config tightened: `ban-ts-comment` now errors without a description, `no-console` errors on `console.log`/`info`/`debug` (warn/error allowed).
- CI (`.github/workflows/build.yaml`) now runs lint and tests in addition to build, on Node.js 20.

### Fixed
- Event listener signatures updated for stricter TypeScript: vault file events now accept `TAbstractFile` and check `instanceof TFile`.
- Class properties annotated with definite assignment where they are initialized post-construction.

## [1.15.2] - 2026-05-13

### Added
- Comprehensive README with feature list, development setup, and changelog reference.
- This `CHANGELOG.md` (covering 1.9.0 onward).
- `repository`, `keywords`, `homepage`, `bugs`, and `lint` script in `package.json`.

## [1.15.1] - 2026-05-13

### Changed
- Inline element styles replaced with CSS classes and CSS custom properties (`vfs-input-narrow`, `vfs-input-wide`, `--vfs-grow`, `--vfs-bar-height`) for Obsidian plugin scorecard compliance.
- CSV export now uses `Vault.process` for atomic read-modify-write.

### Added
- `fundingUrl` in `manifest.json` and `.github/FUNDING.yml`.

### Removed
- Debug `console.log` statements from production code paths.

## [1.15.0] - 2026-05-12

### Added
- Tangles detection: notes with high incoming + outgoing degree, surfaced in a dedicated `Open vault tangles` side view.
- `Create tangles report note` command — Markdown report saved into a configurable folder.
- Settings: AND / OR / SUM selection modes, per-direction thresholds, top-N limit, exclusion list with note/folder fuzzy pickers.

## [1.14.2] - 2026-05-11

### Added
- "Average words per note" metric in the hero panel.
- Per-metric visibility toggles (links, tags, concepts, orphans, avg words).

## [1.14.1] - 2026-05-09

### Changed
- Metric collection pipeline sped up: memoized graph derivatives keyed by generation, batch-tail orphan/trace compute, cheap pre-read signature check.
- Plugin marked desktop-only (`isDesktopOnly: true`).

## [1.14.0] - 2026-05-09

### Added
- Total words metric in hero panel.

## [1.13.1] - 2026-05-09

### Added
- Toggle for the dangling notes list inside the Sources-with-trace section.

## [1.13.0] - 2026-05-09

### Added
- Inbox health section: notes in inbox folders and notes tagged for review, bucketed by age (<1d / 1–7d / 7–30d / 30+d).

## [1.12.4] - 2026-05-09

### Changed
- Dangling sources rendered as clickable note links (top 5).

## [1.12.3] - 2026-05-09

### Changed
- Sidebar sections (folder breakdown, sources-with-trace, taxonomy drift, history, inbox) are opt-in. Default view: hero + ratio + metrics grid.

## [1.12.0–1.12.2] - 2026-05-09

### Added
- Sources-with-trace metric (1.12.0): share of source notes referenced by at least one own note.

### Changed
- PARA folder-group editor reworked into compact one-line `name = paths` rows (1.12.1, 1.12.2).

## [1.11.0] - 2026-05-09

### Added
- Tag taxonomy drift section: rare tags (below configurable threshold) and tags outside the user's canonical set.

## [1.10.0–1.10.3] - 2026-05-09

### Added
- CSV export of statistics history via `Export statistics history to CSV` command (1.10.0).
- In-vault folder picker for CSV destination (1.10.1).
- Native OS save dialog for CSV (with in-vault picker fallback) (1.10.2).

## [1.9.0–1.9.1] - 2026-05-08 / 2026-05-09

### Added
- Orphan-note metric (notes with no incoming links).

### Fixed
- Orphan count is recomputed synchronously during view render (1.9.1).

## Earlier releases

For pre-1.9.0 history, see [GitHub Releases](https://github.com/jtprogru/obsidian-vault-full-statistics-plugin/releases).
