# Changelog

All notable changes to this plugin are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
