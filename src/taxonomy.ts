export interface TagFinding {
	tag: string;
	count: number;
}

export function normalizeCanonical(tags: string[]): Set<string> {
	const out = new Set<string>();
	for (const t of tags) {
		const norm = normalize(t);
		if (norm) out.add(norm);
	}
	return out;
}

// Tag is canonical if it equals a canonical entry exactly OR has one as
// an ancestor: canonical "journal" covers "journal/daily" and
// "journal/weekly", but canonical "journal/daily" does not cover bare
// "journal". Mirrors how Obsidian's Tags pane treats hierarchy.
export function isCanonical(tag: string, canonical: Set<string>): boolean {
	const t = normalize(tag);
	if (!t) return false;
	if (canonical.has(t)) return true;
	for (const c of canonical) {
		if (t.startsWith(c + "/")) return true;
	}
	return false;
}

export function findRareTags(
	occurrences: Record<string, number>,
	threshold: number,
): TagFinding[] {
	const out: TagFinding[] = [];
	for (const [tag, count] of Object.entries(occurrences)) {
		if (count < threshold) {
			const norm = normalize(tag);
			if (norm) out.push({ tag: norm, count });
		}
	}
	return sortFindings(out);
}

export function findUnknownTags(
	occurrences: Record<string, number>,
	canonical: Set<string>,
): TagFinding[] {
	if (canonical.size === 0) return [];
	const out: TagFinding[] = [];
	for (const [tag, count] of Object.entries(occurrences)) {
		const norm = normalize(tag);
		if (!norm) continue;
		if (!isCanonical(norm, canonical)) {
			out.push({ tag: norm, count });
		}
	}
	return sortFindings(out);
}

function normalize(tag: string): string {
	return tag.trim().replace(/^#/, "").toLowerCase();
}

// Sort by count desc, then tag asc. Higher counts surface first because
// frequently-used drift candidates are more impactful to fix.
function sortFindings(findings: TagFinding[]): TagFinding[] {
	return findings.sort((a, b) => {
		if (b.count !== a.count) return b.count - a.count;
		return a.tag.localeCompare(b.tag);
	});
}
