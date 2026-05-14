import { emptyBucketNotes, InboxHealthNotes } from './inbox';
import { InboxReportLabels, renderInboxNotesMarkdown } from './inboxReport';

function makeNotes(over: Partial<{ inFolder: Partial<Record<keyof ReturnType<typeof emptyBucketNotes>, string[]>>; outsideWithTag: Partial<Record<keyof ReturnType<typeof emptyBucketNotes>, string[]>> }> = {}): InboxHealthNotes {
	const inFolder = emptyBucketNotes();
	const outsideWithTag = emptyBucketNotes();
	if (over.inFolder) Object.assign(inFolder, over.inFolder);
	if (over.outsideWithTag) Object.assign(outsideWithTag, over.outsideWithTag);
	return { inFolder, outsideWithTag };
}

function makeLabels(over: Partial<InboxReportLabels> = {}): InboxReportLabels {
	return {
		inFolderLabel: 'Inbox/',
		outsideWithTagLabel: '#review (outside inbox)',
		hasFolders: true,
		hasTags: true,
		...over,
	};
}

const FIXED_DATE = new Date('2026-05-14T12:00:00Z');

describe('renderInboxNotesMarkdown', () => {
	test('happy path: both groups across multiple buckets', () => {
		const notes = makeNotes({
			inFolder: {
				fresh: ['Inbox/today.md'],
				stale: ['Inbox/older.md'],
			},
			outsideWithTag: {
				recent: ['Notes/review-me.md'],
			},
		});
		const md = renderInboxNotesMarkdown(notes, makeLabels(), FIXED_DATE);
		expect(md).toBe([
			'## Inbox health — 2026-05-14',
			'',
			'### Inbox/',
			'',
			'#### fresh (<1d)',
			'- [[Inbox/today]]',
			'',
			'#### stale (7–30d)',
			'- [[Inbox/older]]',
			'',
			'### #review (outside inbox)',
			'',
			'#### recent (1–7d)',
			'- [[Notes/review-me]]',
		].join('\n'));
	});

	test('bucket order is always fresh → recent → stale → old regardless of input order', () => {
		const notes = makeNotes({
			inFolder: {
				old: ['a.md'],
				fresh: ['b.md'],
				stale: ['c.md'],
				recent: ['d.md'],
			},
		});
		const md = renderInboxNotesMarkdown(notes, makeLabels({ hasTags: false }), FIXED_DATE);
		const headingOrder = md.match(/####.*/g);
		expect(headingOrder).toEqual([
			'#### fresh (<1d)',
			'#### recent (1–7d)',
			'#### stale (7–30d)',
			'#### old (30+d)',
		]);
	});

	test('paths are sorted alphabetically within a bucket', () => {
		const notes = makeNotes({
			inFolder: {
				fresh: ['zeta.md', 'alpha.md', 'mu.md'],
			},
		});
		const md = renderInboxNotesMarkdown(notes, makeLabels({ hasTags: false }), FIXED_DATE);
		expect(md).toContain('- [[alpha]]\n- [[mu]]\n- [[zeta]]');
	});

	test('hasFolders: false → inFolder group is omitted', () => {
		const notes = makeNotes({
			inFolder: { fresh: ['should-not-appear.md'] },
			outsideWithTag: { fresh: ['tagged.md'] },
		});
		const md = renderInboxNotesMarkdown(notes, makeLabels({ hasFolders: false }), FIXED_DATE);
		expect(md).not.toContain('should-not-appear');
		expect(md).not.toContain('### Inbox/');
		expect(md).toContain('### #review (outside inbox)');
		expect(md).toContain('- [[tagged]]');
	});

	test('hasTags: false → outsideWithTag group is omitted', () => {
		const notes = makeNotes({
			inFolder: { fresh: ['kept.md'] },
			outsideWithTag: { fresh: ['should-not-appear.md'] },
		});
		const md = renderInboxNotesMarkdown(notes, makeLabels({ hasTags: false }), FIXED_DATE);
		expect(md).not.toContain('should-not-appear');
		expect(md).not.toContain('outside inbox');
		expect(md).toContain('### Inbox/');
		expect(md).toContain('- [[kept]]');
	});

	test('empty group renders _Empty._', () => {
		const notes = makeNotes({
			outsideWithTag: { fresh: ['only-tagged.md'] },
		});
		const md = renderInboxNotesMarkdown(notes, makeLabels(), FIXED_DATE);
		expect(md).toContain('### Inbox/\n\n_Empty._');
		expect(md).toContain('- [[only-tagged]]');
	});

	test('wikilinks preserve folder prefix and strip .md extension', () => {
		const notes = makeNotes({
			inFolder: {
				fresh: ['Some Folder/Sub/Note With Spaces.md', 'no-extension'],
			},
		});
		const md = renderInboxNotesMarkdown(notes, makeLabels({ hasTags: false }), FIXED_DATE);
		expect(md).toContain('- [[Some Folder/Sub/Note With Spaces]]');
		expect(md).toContain('- [[no-extension]]');
	});

	test('date in heading uses local Y-M-D', () => {
		const md = renderInboxNotesMarkdown(
			makeNotes({ inFolder: { fresh: ['a.md'] } }),
			makeLabels({ hasTags: false }),
			new Date(2026, 0, 3, 9), // 2026-01-03 local
		);
		expect(md.startsWith('## Inbox health — 2026-01-03')).toBe(true);
	});

	test('no trailing blank lines in clipboard payload', () => {
		const notes = makeNotes({ inFolder: { fresh: ['a.md'] } });
		const md = renderInboxNotesMarkdown(notes, makeLabels({ hasTags: false }), FIXED_DATE);
		expect(md.endsWith('\n')).toBe(false);
		expect(md.endsWith(' ')).toBe(false);
	});

	test('both groups empty → headers present but no notes', () => {
		const md = renderInboxNotesMarkdown(makeNotes(), makeLabels(), FIXED_DATE);
		expect(md).toContain('### Inbox/');
		expect(md).toContain('### #review (outside inbox)');
		const empties = md.match(/_Empty\._/g) ?? [];
		expect(empties.length).toBe(2);
	});
});
