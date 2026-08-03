import { AgeBucket, InboxBucketNotes, InboxHealthNotes } from './inbox';
import { wikilinkTargetForPath } from './tangles';
import { t } from './i18n';

const AGE_ORDER: AgeBucket[] = ['fresh', 'recent', 'stale', 'old'];

/**
 * A function rather than a constant so the labels are read when the report is
 * rendered — a module-level object would freeze on the locale that happened to
 * be active at import time.
 */
function ageLabels(): Record<AgeBucket, string> {
	const labels = t().inbox;
	return {
		fresh: labels.ageFresh,
		recent: labels.ageRecent,
		stale: labels.ageStale,
		old: labels.ageOld,
	};
}

export interface InboxReportLabels {
	inFolderLabel: string;
	outsideWithTagLabel: string;
	hasFolders: boolean;
	hasTags: boolean;
}

export function renderInboxNotesMarkdown(
	notes: InboxHealthNotes,
	labels: InboxReportLabels,
	now: Date,
): string {
	const lines: string[] = [];
	lines.push(t().inbox.reportTitle(formatYmd(now)));
	lines.push('');
	if (labels.hasFolders) appendGroup(lines, labels.inFolderLabel, notes.inFolder);
	if (labels.hasTags) appendGroup(lines, labels.outsideWithTagLabel, notes.outsideWithTag);
	// Trim trailing blank lines so clipboard payload is clean.
	while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
	return lines.join('\n');
}

function appendGroup(lines: string[], title: string, bucket: InboxBucketNotes): void {
	const labels = ageLabels();
	lines.push(`### ${title}`);
	lines.push('');
	let any = false;
	for (const age of AGE_ORDER) {
		const paths = [...bucket[age]].sort((a, b) => a.localeCompare(b));
		if (paths.length === 0) continue;
		any = true;
		lines.push(`#### ${labels[age]}`);
		for (const p of paths) lines.push(`- [[${wikilinkTargetForPath(p)}]]`);
		lines.push('');
	}
	if (!any) {
		lines.push(t().inbox.reportEmpty);
		lines.push('');
	}
}

function formatYmd(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}
