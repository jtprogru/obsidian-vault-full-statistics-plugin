export type AgeBucket = 'fresh' | 'recent' | 'stale' | 'old';

export interface InboxBucket {
	fresh: number;   // < 1 day
	recent: number;  // 1 to 7 days
	stale: number;   // 7 to 30 days
	old: number;     // 30+ days
	total: number;
}

export interface InboxHealth {
	inFolder: InboxBucket;
	outsideWithTag: InboxBucket;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function emptyBucket(): InboxBucket {
	return { fresh: 0, recent: 0, stale: 0, old: 0, total: 0 };
}

// Negative ageDays (file appears to be in the future, e.g. clock skew or
// future-dated frontmatter) is clamped into "fresh" so the count never
// drops a real file. Boundaries are half-open: 1.0d → recent, 7.0d →
// stale, 30.0d → old.
export function bucketForAge(ageDays: number): AgeBucket {
	if (ageDays < 1) return 'fresh';
	if (ageDays < 7) return 'recent';
	if (ageDays < 30) return 'stale';
	return 'old';
}

export function addToBucket(bucket: InboxBucket, ageDays: number): void {
	const which = bucketForAge(ageDays);
	bucket[which] += 1;
	bucket.total += 1;
}
