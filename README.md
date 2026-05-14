# Vault Full Statistics Plugin

[![Latest release](https://img.shields.io/github/v/release/jtprogru/obsidian-vault-full-statistics-plugin?sort=semver&label=release)](https://github.com/jtprogru/obsidian-vault-full-statistics-plugin/releases)
[![Min Obsidian](https://img.shields.io/badge/Obsidian-%E2%89%A50.16.0-7c3aed)](https://obsidian.md)
[![Build](https://img.shields.io/github/actions/workflow/status/jtprogru/obsidian-vault-full-statistics-plugin/build.yaml?branch=main&label=build)](https://github.com/jtprogru/obsidian-vault-full-statistics-plugin/actions/workflows/build.yaml)
[![Downloads](https://img.shields.io/github/downloads/jtprogru/obsidian-vault-full-statistics-plugin/total)](https://github.com/jtprogru/obsidian-vault-full-statistics-plugin/releases)
[![License](https://img.shields.io/github/license/jtprogru/obsidian-vault-full-statistics-plugin)](LICENSE)
[![Sponsor](https://img.shields.io/github/sponsors/jtprogru?logo=github)](https://github.com/sponsors/jtprogru)

**NOTE**: This plugin is a modified fork of the [Obsidian Vault Statistics Plugin](https://github.com/bkyle/obsidian-vault-statistics-plugin).

Quantify the shape of your knowledge base: counts, ratios, and trends right inside Obsidian. A click-to-cycle status bar item gives you the headline numbers; a dedicated side view goes deep — own vs source split, dangling sources, tangles, inbox health, taxonomy drift, and a 30-day sparkline.

**Requires:** Obsidian 0.16.0+ on desktop. Mobile is not supported.

## Features

### Status bar
- Notes, links, tags, QoV (Quality of Vault = links ÷ notes)
- Own / source counts and percentages
- Concepts and orphans (no incoming links)
- Trace percentage (share of source notes referenced by at least one own note)
- Click to cycle, hover to see everything at once
- CSS snippets to show several stats simultaneously (see [Advanced Usage](#advanced-usage))

### Side view (`Open vault statistics` command)
- **Hero panel** — notes, total words, QoV in big readable type
- **Own vs source ratio bar** — your thinking vs external material, with concepts as a grey zone
- **Metrics grid** — links, tags, concepts, orphans, average words per note (each toggleable)
- **Sources with trace** — how many source notes are linked from your own notes; surfaces dangling sources as clickable pills
- **Inbox health** — notes in inbox folders or tagged for review, bucketed by age (<1d / 1–7d / 7–30d / 30+d)
- **Folder breakdown** — PARA-style groups with own/source split per group
- **Tag taxonomy drift** — rare tags (likely typos) and tags outside your canonical set
- **30-day history sparkline** — daily snapshots of notes, own, source, links, tags, orphans, traced

### Tangles
A "tangle" is a note that bridges large parts of your graph — many incoming links, many outgoing links, or both. The plugin can:
- List tangles in a dedicated `Open vault tangles` side view, sorted by selected mode (AND / OR / SUM thresholds)
- Generate a Markdown report note via `Create tangles report note`, dropped into a configurable folder

### CSV export
`Export statistics history to CSV` opens the native OS save dialog (with an in-vault folder picker fallback) and writes the full history snapshot stream as CSV — for use in spreadsheets, Jupyter, or anything else.

## Installation

**Recommended — Obsidian Community Plugins:** the plugin is published in the official Obsidian community plugin catalog. Open `Settings → Community plugins → Browse`, search for **Vault Full Statistics**, click *Install*, then *Enable*. Updates are delivered through Obsidian itself.

For pre-releases (testing unreleased features), use [BRAT](https://github.com/TfTHacker/obsidian42-brat): add `jtprogru/obsidian-vault-full-statistics-plugin` and enable it.

Manual install: grab the latest `main.js`, `manifest.json`, and `styles.css` from the [release section](https://github.com/jtprogru/obsidian-vault-full-statistics-plugin/releases) and drop them into `<vault>/.obsidian/plugins/vault-full-statistics/`.

This plugin is desktop-only.

## Usage

After enabling, the status bar shows a count. Click to cycle through statistics; hover to see all of them in a tooltip. Toggle which statistics are visible in the plugin settings.

Open the side view via `Open vault statistics` (command palette or ribbon icon). Sections beyond the hero are opt-in — enable Folder breakdown, Sources-with-trace, Inbox health, Tag taxonomy drift, and History in settings to surface them.

For own/source classification, configure your own/source/concept tags in settings (defaults: `thought`, `book`, `concept`, etc.). Any note carrying one of those tags is counted accordingly.

## Settings reference

All settings live under `Settings → Community plugins → Vault Full Statistics`. Defaults are sensible — most users only touch own/source tags and the opt-in section toggles.

### Status bar
- **Show individual items** — when on, every enabled statistic is rendered as its own status bar slot; when off (default) the bar shows one statistic at a time and clicking cycles. Below toggles apply when this is on.
- **Show notes / links / tags / quality / own / source / own % / source % / concepts / orphans / trace %** — visibility of each individual status bar stat.

### Metrics section (side view)
Toggle which secondary metrics appear in the side view's grid below the hero panel:
- **Links**, **Tags**, **Concepts**, **Orphans**, **Avg words** — all on by default.

### Classification
- **Excluded folders** — folders to skip entirely (templates, archives, plugin data). Matched as path prefix with a `/` boundary.
- **Own tags** (default: `thought`, `synthesis`, `fleeting`) — mark notes as your own thinking.
- **Source tags** (default: `book`, `article`, `video`, `lecture`, `literature`, `literature-note`) — mark notes about external material.
- **Concept tags** (default: `concept`) — the grey zone between own and source.

### Folder breakdown (PARA)
- **Show folder breakdown** (default: off) — opt-in section that breaks down notes per folder group.
- **Folder groups** — one row per group, `name = path1, path2`. Multiple paths per group are merged; overlap allowed.

### Sources with trace
- **Show sources-with-trace** (default: off) — opt-in section showing how many source notes are referenced by at least one own note.
- **Show dangling notes list** (default: on) — top 5 untraced source notes inside the section.

### Tag taxonomy drift
- **Show taxonomy drift** (default: off) — opt-in section listing rare tags and tags outside your canonical set.
- **Rare tag threshold** (default: 3) — tags used fewer than this many times are flagged.
- **Canonical tags** — your accepted tag set. Anything else is flagged as unknown; a canonical parent (e.g. `journal`) covers descendants (`journal/daily`).

### Inbox health
- **Show inbox health** (default: off) — opt-in section bucketing inbox notes by age.
- **Inbox folders** — folders treated as inbox.
- **Inbox review tags** (default: `inbox/review`) — tags marking notes that need processing outside inbox folders.

### History
- **Show history** (default: off) — opt-in 30-day sparkline. Snapshots are recorded daily regardless of this toggle.
- **History export folder** — last folder used for CSV export. The export command updates this on use.

### Tangles
- **Selection mode** (default: AND) — `AND` (both directions must meet threshold), `OR` (either direction), `SUM` (in + out must meet a single threshold).
- **Min incoming links** / **Min outgoing links** (default: 5 each) — thresholds for AND/OR modes.
- **Min in + out** (default: 10) — threshold for SUM mode.
- **Top N** (default: 25) — limit how many tangles to show in the view and report. `0` means no limit.
- **Tangles report folder** — where `Create tangles report note` saves its output. Empty = vault root.
- **Tangles exclude** — notes (full path) or folder prefixes to skip in tangle detection. Folder match requires a trailing slash boundary.

## FAQ / Troubleshooting

**What is QoV?**
Quality of Vault = total links ÷ total notes. A measure of how interconnected your vault is. There's no objective "good" value; track the trend instead.

**Why does the notes count differ from Obsidian's File pane?**
The plugin counts Markdown notes only and skips Excalidraw drawings and Kanban boards (they're file containers, not text). It also skips excluded folders configured in settings. If a number still looks off, check whether your vault contains `.excalidraw.md` files or notes with `excalidraw-plugin` / `kanban-plugin` in frontmatter.

**The side view is empty / shows "no notes classified yet" — why?**
The own/source ratio needs notes tagged with own or source tags. Out of the box the defaults are sensible (`#thought`, `#book`, `#article`, ...), but if you use different tag names, configure them in settings. The hero panel and metrics grid render regardless.

**When are history snapshots taken?**
Once per local day, debounced by 10 seconds after the last metric update. The very first snapshot appears once your vault metrics settle on first load. A second day is required before the sparkline can render a trend.

**How do I set up own/source classification for my own taxonomy?**
1. Decide on tag names that represent your own thinking versus external material.
2. Add them to **Own tags** / **Source tags** in settings (the leading `#` is optional).
3. The collector restarts and reclassifies on save — no Obsidian restart needed.

**What's a "tangle"?**
A note that bridges large parts of your graph — high incoming-link count, high outgoing-link count, or both. Useful for finding MOCs (maps of content), index notes, and accidentally over-connected hubs. Detection mode (AND/OR/SUM) and thresholds are configurable.

**Does this work on mobile?**
No. `isDesktopOnly` is set in the manifest. The metric pipeline (vault scan + memoization) is tuned for desktop and uses APIs not available on iOS.

**How do I exclude a specific note or folder from statistics?**
- **From counts entirely** — add the folder to **Excluded folders**.
- **From tangle detection only** — use the **Tangles exclude** list (note path or folder prefix).

**My CSV export saves to vault instead of disk.**
Native save dialog (File System Access API) is preferred when available; the plugin falls back to an in-vault folder picker on environments without it. Use a recent Obsidian + Electron build to get the OS dialog.

## Advanced Usage

### Showing All Statistics

All statistics can be shown by creating and enabling a CSS snippet with the following content.

```css
/* Show all vault statistics. */
.obsidian-vault-full-statistics--item {
    display: initial !important;
}
```

### Showing Selected Statistics

Similarly, one can show certain statistics. Below is a snippet that hides all but the notes statistic. The snippet can be modified to include more or different statistics.

```css
/* Hide all statistics. */
.obsidian-vault-full-statistics--item {
    display: none !important;
}

/* Always show the notes statistic. */
.obsidian-vault-full-statistics--item-notes {
    display: initial !important;
}
```

## Development

Requires Node.js 18+ and npm.

```bash
git clone https://github.com/jtprogru/obsidian-vault-full-statistics-plugin
cd obsidian-vault-full-statistics-plugin
npm install
npm run dev      # watch-mode esbuild — rebuilds main.js on save
npm test         # jest test suite
npm run lint     # eslint
npm run build    # production build (tsc type-check + esbuild)
```

For iterating against a live vault, symlink the repo into `<vault>/.obsidian/plugins/vault-full-statistics/` and toggle the plugin off/on in Obsidian after each rebuild.

Source code lives in `src/`. Notable modules:
- `main.ts` — plugin entry point, status bar, commands
- `statisticsView.ts` — side view rendering (hero, sections)
- `collect.ts` — vault metrics collector and memoized graph derivatives
- `tangles.ts` / `tanglesView.ts` — high-degree note detection and report
- `historyStore.ts` — daily snapshots and CSV export
- `settings.ts` — settings tab

A `Taskfile.yml` is included for common operations if you use [Task](https://taskfile.dev).

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for notable changes per release, or the full list at [GitHub Releases](https://github.com/jtprogru/obsidian-vault-full-statistics-plugin/releases).

## License

[MIT](LICENSE)
