import { UNIT_TOKENIZER } from './text';
import { BytesFormatter, DecimalUnitFormatter } from './format';
import { FullVaultMetrics } from './metrics';

describe("Unit tokenize", () => {
	test("always returns empty array", () => {
		expect(UNIT_TOKENIZER.tokenize("")).toStrictEqual([]);
		expect(UNIT_TOKENIZER.tokenize("foo bar baz")).toStrictEqual([]);
		expect(UNIT_TOKENIZER.tokenize("12345")).toStrictEqual([]);
	});
});

describe("Bytes formatter", () => {
	const fmt = new BytesFormatter();
	test("formats bytes < 1KB", () => {
		expect(fmt.format(512)).toBe("512.00 bytes");
	});
	test("formats KB", () => {
		expect(fmt.format(2048)).toBe("2.00 KB");
	});
	test("formats MB", () => {
		expect(fmt.format(1048576)).toBe("1.00 MB");
	});
	test("formats GB", () => {
		expect(fmt.format(1073741824)).toBe("1.00 GB");
	});
});

describe("Decimal unit formatter", () => {
	const fmt = new DecimalUnitFormatter("notes");
	test("formats integer", () => {
		expect(fmt.format(1234)).toBe("1,234 notes");
	});
	test("formats zero", () => {
		expect(fmt.format(0)).toBe("0 notes");
	});
	test("formats negative", () => {
		expect(fmt.format(-42)).toBe("-42 notes");
	});
});

describe("Full vault metrics", () => {
	test("reset sets all to zero except quality", () => {
		const m = new FullVaultMetrics();
		m.notes = 2; m.links = 10; m.quality = 42;
		m.reset();
		expect(m.notes).toBe(0);
		expect(m.links).toBe(0);
		expect(m.quality).toBeCloseTo(0.00001);
	});
	test("inc and dec update values", () => {
		const m = new FullVaultMetrics();
		const delta = new FullVaultMetrics();
		delta.notes = 2;
		delta.links = 5;
		delta.quality = 0;
		m.inc(delta);
		expect(m.notes).toBe(2);
		expect(m.links).toBe(5);
		m.dec(delta);
		expect(m.notes).toBe(0);
		expect(m.links).toBe(0);
	});
});
