# Vault Full Statistics Plugin

![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/jtprogru/obsidian-vault-full-statistics-plugin/total)
![GitHub License](https://img.shields.io/github/license/jtprogru/obsidian-vault-full-statistics-plugin)

**NOTE**: This plugin is a modified fork of the [Obsidian Vault Statistics Plugin](https://github.com/bkyle/obsidian-vault-statistics-plugin).

Quantify the shape of your knowledge base: counts, ratios, and trends right inside Obsidian. A click-to-cycle status bar item gives you the headline numbers; a dedicated side view goes deep — own vs source split, dangling sources, tangles, inbox health, taxonomy drift, and a 30-day sparkline.

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

The fastest path is [BRAT](https://github.com/TfTHacker/obsidian42-brat): add `jtprogru/obsidian-vault-full-statistics-plugin` and enable it.

Manual install: grab the latest `main.js`, `manifest.json`, and `styles.css` from the [release section](https://github.com/jtprogru/obsidian-vault-full-statistics-plugin/releases) and drop them into `<vault>/.obsidian/plugins/vault-full-statistics/`.

This plugin is desktop-only.

## Usage

After enabling, the status bar shows a count. Click to cycle through statistics; hover to see all of them in a tooltip. Toggle which statistics are visible in the plugin settings.

Open the side view via `Open vault statistics` (command palette or ribbon icon). Sections beyond the hero are opt-in — enable Folder breakdown, Sources-with-trace, Inbox health, Tag taxonomy drift, and History in settings to surface them.

For own/source classification, configure your own/source/concept tags in settings (defaults: `thought`, `book`, `concept`, etc.). Any note carrying one of those tags is counted accordingly.

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

[WTFPL](LICENSE)
