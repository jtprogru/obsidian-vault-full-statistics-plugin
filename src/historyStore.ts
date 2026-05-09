import { FullVaultMetrics } from './metrics';

export interface Snapshot {
	date: string; // YYYY-MM-DD in local time
	notes: number;
	links: number;
	tags: number;
	ownNotes: number;
	sourceNotes: number;
	conceptNotes: number;
	orphanNotes: number;
	sourcesWithTrace?: number;
	words?: number;
}

const DEFAULT_MAX_SNAPSHOTS = 365;

export class HistoryStore {
	private snapshots: Snapshot[];
	private readonly maxSnapshots: number;

	constructor(snapshots: Snapshot[] = [], maxSnapshots: number = DEFAULT_MAX_SNAPSHOTS) {
		this.maxSnapshots = maxSnapshots;
		// Sort defensively in case persisted data is out of order, then trim.
		this.snapshots = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
		while (this.snapshots.length > this.maxSnapshots) this.snapshots.shift();
	}

	/**
	 * Records a snapshot for the date of `now` if no snapshot for that date
	 * already exists. If a snapshot for today already exists, overwrites its
	 * values with the latest metrics — this keeps the day's row representing
	 * the *latest known* state of the vault rather than the first reading
	 * of the morning.
	 *
	 * Returns true if the snapshots array was mutated.
	 */
	public recordIfNeeded(now: Date, metrics: FullVaultMetrics): boolean {
		const date = formatDate(now);
		const snapshot: Snapshot = {
			date,
			notes: metrics.notes,
			links: metrics.links,
			tags: metrics.tags,
			ownNotes: metrics.ownNotes,
			sourceNotes: metrics.sourceNotes,
			conceptNotes: metrics.conceptNotes,
			orphanNotes: metrics.orphanNotes,
			sourcesWithTrace: metrics.sourcesWithTrace,
			words: metrics.words,
		};

		const last = this.snapshots[this.snapshots.length - 1];
		if (last && last.date === date) {
			if (snapshotEquals(last, snapshot)) return false;
			this.snapshots[this.snapshots.length - 1] = snapshot;
			return true;
		}

		this.snapshots.push(snapshot);
		while (this.snapshots.length > this.maxSnapshots) this.snapshots.shift();
		return true;
	}

	public all(): Snapshot[] {
		return [...this.snapshots];
	}

	public recent(days: number): Snapshot[] {
		if (days <= 0) return [];
		return this.snapshots.slice(-days);
	}

	public size(): number {
		return this.snapshots.length;
	}

	public lastDate(): string | null {
		const last = this.snapshots[this.snapshots.length - 1];
		return last ? last.date : null;
	}
}

export function formatDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

const SPARKLINE_BLOCKS = '▁▂▃▄▅▆▇█';

export function sparkline(values: number[]): string {
	if (values.length === 0) return '';
	let min = values[0];
	let max = values[0];
	for (const v of values) {
		if (v < min) min = v;
		if (v > max) max = v;
	}
	const range = max - min;
	if (range === 0) return SPARKLINE_BLOCKS[0].repeat(values.length);
	const lastIdx = SPARKLINE_BLOCKS.length - 1;
	let out = '';
	for (const v of values) {
		const idx = Math.round(((v - min) / range) * lastIdx);
		out += SPARKLINE_BLOCKS[idx];
	}
	return out;
}

export function pctString(v: number): string {
	return `${Math.round(v * 100)}%`;
}

const CSV_COLUMNS: (keyof Snapshot)[] = [
	'date', 'notes', 'links', 'tags', 'words',
	'ownNotes', 'sourceNotes', 'conceptNotes', 'orphanNotes', 'sourcesWithTrace',
];

export function snapshotsToCsv(snapshots: Snapshot[]): string {
	const header = CSV_COLUMNS.join(',');
	const rows = snapshots.map(s => CSV_COLUMNS.map(c => {
		const v = s[c];
		// Old snapshots may lack newer columns — emit empty so the CSV
		// stays a strict rectangle without inventing fake zeros.
		if (v === undefined) return '';
		return typeof v === 'string' ? v : String(v);
	}).join(','));
	return [header, ...rows].join('\n');
}

function snapshotEquals(a: Snapshot, b: Snapshot): boolean {
	return a.notes === b.notes
		&& a.links === b.links
		&& a.tags === b.tags
		&& a.ownNotes === b.ownNotes
		&& a.sourceNotes === b.sourceNotes
		&& a.conceptNotes === b.conceptNotes
		&& a.orphanNotes === b.orphanNotes
		&& (a.sourcesWithTrace ?? 0) === (b.sourcesWithTrace ?? 0)
		&& (a.words ?? 0) === (b.words ?? 0);
}
