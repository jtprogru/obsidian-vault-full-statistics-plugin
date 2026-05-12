import { FullVaultMetricsCollector } from './collect';
import { FullStatisticsPluginSettings } from './settings';

export interface TangleEntry {
	path: string;
	inCount: number;
	outCount: number;
}

export type TanglesMode = 'and' | 'or' | 'sum';

export type TanglesSettings = Pick<
	FullStatisticsPluginSettings,
	'tanglesMode' | 'tanglesMinIn' | 'tanglesMinOut' | 'tanglesMinTotal' | 'tanglesTopN' | 'tanglesExclude'
>;

/**
 * Normalizes exclusion entries so trailing slashes, whitespace, and empty
 * rows do not silently fall through. Returned list is used by
 * {@link isExcludedPath} which accepts either an exact path match or a
 * folder-prefix match — mirroring the convention used by
 * `excludedFolders` in the collector so users learn one rule.
 */
function normalizeExcludes(raw: string[] | undefined): string[] {
	if (!raw) return [];
	return raw
		.map(s => s.trim().replace(/\/+$/, ''))
		.filter(s => s.length > 0);
}

export function isExcludedPath(path: string, excludes: string[]): boolean {
	for (const e of excludes) {
		if (path === e) return true;
		if (path.startsWith(e + '/')) return true;
	}
	return false;
}

/**
 * Selects notes that act as "tangles" — heavily connected nodes in the
 * vault graph. Outgoing/incoming counts are graph degrees from
 * metadataCache.resolvedLinks (distinct destinations / sources), not raw
 * link occurrences in the note body. Three selection modes are exposed
 * so the user can pick a definition that matches their intuition:
 *
 *   - 'and': both in ≥ minIn AND out ≥ minOut (classic hub)
 *   - 'or':  either in ≥ minIn OR out ≥ minOut (looser, includes pure sinks/sources)
 *   - 'sum': in + out ≥ minTotal (one knob; ignores direction)
 *
 * Results are sorted by (in + out) DESC with stable tie-breakers on
 * incoming-DESC then path-ASC so two notes with the same total appear
 * in the same order across renders. `limitOverride` lets callers (e.g.
 * a side view with its own cap) override the persisted `tanglesTopN`
 * without mutating settings; pass `0` or `undefined` for no limit.
 */
export function computeTangles(
	collector: FullVaultMetricsCollector,
	settings: TanglesSettings,
	limitOverride?: number,
): TangleEntry[] {
	const { incoming, outgoing } = collector.computeLinkValency();
	const mode = settings.tanglesMode;
	const minIn = Math.max(0, Math.floor(settings.tanglesMinIn));
	const minOut = Math.max(0, Math.floor(settings.tanglesMinOut));
	const minTotal = Math.max(0, Math.floor(settings.tanglesMinTotal));
	const excludes = normalizeExcludes(settings.tanglesExclude);

	const entries: TangleEntry[] = [];
	for (const path of collector.listNotePaths()) {
		if (isExcludedPath(path, excludes)) continue;
		const inCount = incoming.get(path) ?? 0;
		const outCount = outgoing.get(path) ?? 0;
		if (!passesFilter(mode, inCount, outCount, minIn, minOut, minTotal)) continue;
		entries.push({ path, inCount, outCount });
	}

	entries.sort((a, b) => {
		const totalDiff = (b.inCount + b.outCount) - (a.inCount + a.outCount);
		if (totalDiff !== 0) return totalDiff;
		const inDiff = b.inCount - a.inCount;
		if (inDiff !== 0) return inDiff;
		return a.path.localeCompare(b.path);
	});

	const persistedLimit = Math.max(0, Math.floor(settings.tanglesTopN));
	const limit = limitOverride !== undefined ? Math.max(0, Math.floor(limitOverride)) : persistedLimit;
	if (limit > 0 && entries.length > limit) {
		return entries.slice(0, limit);
	}
	return entries;
}

function passesFilter(
	mode: TanglesMode,
	inCount: number,
	outCount: number,
	minIn: number,
	minOut: number,
	minTotal: number,
): boolean {
	if (mode === 'or') return inCount >= minIn || outCount >= minOut;
	if (mode === 'sum') return (inCount + outCount) >= minTotal;
	return inCount >= minIn && outCount >= minOut;
}

/**
 * Strips the .md extension from a note path so it can be embedded in an
 * Obsidian wikilink. Path-based wikilinks (`[[Folder/Note]]`) are more
 * robust than basename-only when two notes share a basename.
 */
export function wikilinkTargetForPath(path: string): string {
	return path.endsWith('.md') ? path.slice(0, -3) : path;
}

/**
 * Renders the tangles report as a Markdown document. Pure for testability
 * — no Obsidian dependency. The header surfaces the selection settings so
 * a future reader can tell which mode produced the list.
 */
export function renderTanglesReport(
	entries: TangleEntry[],
	settings: TanglesSettings,
	now: Date,
): string {
	const dateStr = formatDate(now);
	const modeDesc = describeMode(settings);
	const lines: string[] = [];
	lines.push(`# Vault Tangles — ${dateStr}`);
	lines.push('');
	lines.push(`- Mode: ${modeDesc}`);
	lines.push(`- Total tangles: ${entries.length}`);
	lines.push('');

	if (entries.length === 0) {
		lines.push('_No notes match the current tangle thresholds._');
		lines.push('');
		return lines.join('\n');
	}

	lines.push('| In | Out | Note |');
	lines.push('|---:|---:|---|');
	for (const e of entries) {
		lines.push(`| ${e.inCount} | ${e.outCount} | [[${wikilinkTargetForPath(e.path)}]] |`);
	}
	lines.push('');
	return lines.join('\n');
}

function describeMode(settings: TanglesSettings): string {
	if (settings.tanglesMode === 'sum') {
		return `\`sum\` · in+out ≥ ${settings.tanglesMinTotal}`;
	}
	const op = settings.tanglesMode === 'or' ? 'OR' : 'AND';
	return `\`${settings.tanglesMode}\` · in ≥ ${settings.tanglesMinIn} ${op} out ≥ ${settings.tanglesMinOut}`;
}

export function formatDate(now: Date): string {
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	const hh = String(now.getHours()).padStart(2, '0');
	const mm = String(now.getMinutes()).padStart(2, '0');
	return `${y}-${m}-${d} ${hh}-${mm}`;
}
