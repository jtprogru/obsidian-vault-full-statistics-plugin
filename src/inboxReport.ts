import { AgeBucket, InboxBucketNotes, InboxHealthNotes } from './inbox';
import { wikilinkTargetForPath } from './tangles';

const AGE_ORDER: AgeBucket[] = ['fresh', 'recent', 'stale', 'old'];

const AGE_LABELS: Record<AgeBucket, string> = {
	fresh: 'fresh (<1d)',
	recent: 'recent (1–7d)',
	stale: 'stale (7–30d)',
	old: 'old (30+d)',
};

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
	lines.push(`## Inbox health — ${formatYmd(now)}`);
	lines.push('');
	if (labels.hasFolders) appendGroup(lines, labels.inFolderLabel, notes.inFolder);
	if (labels.hasTags) appendGroup(lines, labels.outsideWithTagLabel, notes.outsideWithTag);
	// Trim trailing blank lines so clipboard payload is clean.
	while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
	return lines.join('\n');
}

function appendGroup(lines: string[], title: string, bucket: InboxBucketNotes): void {
	lines.push(`### ${title}`);
	lines.push('');
	let any = false;
	for (const age of AGE_ORDER) {
		const paths = [...bucket[age]].sort((a, b) => a.localeCompare(b));
		if (paths.length === 0) continue;
		any = true;
		lines.push(`#### ${AGE_LABELS[age]}`);
		for (const p of paths) lines.push(`- [[${wikilinkTargetForPath(p)}]]`);
		lines.push('');
	}
	if (!any) {
		lines.push('_Empty._');
		lines.push('');
	}
}

function formatYmd(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}
