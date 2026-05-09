import { addToBucket, bucketForAge, emptyBucket } from './inbox';

describe("bucketForAge", () => {
	test("strictly less than 1 day is fresh", () => {
		expect(bucketForAge(0)).toBe('fresh');
		expect(bucketForAge(0.5)).toBe('fresh');
		expect(bucketForAge(0.999)).toBe('fresh');
	});

	test("exactly 1 day flips to recent", () => {
		expect(bucketForAge(1)).toBe('recent');
		expect(bucketForAge(3)).toBe('recent');
		expect(bucketForAge(6.999)).toBe('recent');
	});

	test("exactly 7 days flips to stale", () => {
		expect(bucketForAge(7)).toBe('stale');
		expect(bucketForAge(15)).toBe('stale');
		expect(bucketForAge(29.999)).toBe('stale');
	});

	test("exactly 30 days is old", () => {
		expect(bucketForAge(30)).toBe('old');
		expect(bucketForAge(100)).toBe('old');
		expect(bucketForAge(10000)).toBe('old');
	});

	test("negative age clamps to fresh (clock skew / future ctime)", () => {
		expect(bucketForAge(-1)).toBe('fresh');
		expect(bucketForAge(-100)).toBe('fresh');
	});
});

describe("addToBucket", () => {
	test("increments the right counter and the total", () => {
		const b = emptyBucket();
		addToBucket(b, 0.1);
		addToBucket(b, 3);
		addToBucket(b, 3);
		addToBucket(b, 14);
		addToBucket(b, 50);
		expect(b).toStrictEqual({ fresh: 1, recent: 2, stale: 1, old: 1, total: 5 });
	});

	test("starting from emptyBucket, all counters and total are zero", () => {
		expect(emptyBucket()).toStrictEqual({ fresh: 0, recent: 0, stale: 0, old: 0, total: 0 });
	});
});
