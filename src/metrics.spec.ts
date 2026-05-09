import { Events } from 'obsidian';
import { FullVaultMetrics } from './metrics';

function makeIncrement(notes: number, links: number): FullVaultMetrics {
	const m = new FullVaultMetrics();
	m.notes = notes;
	m.links = links;
	return m;
}

describe("FullVaultMetrics — batch coalescing", () => {
	let v: FullVaultMetrics;
	let triggerSpy: jest.SpyInstance;

	beforeEach(() => {
		// Spy on the inherited Events.prototype.trigger so we observe the
		// 'updated' fan-out without depending on real subscribers. fire()
		// calls super.trigger("updated"), which goes through this method.
		triggerSpy = jest.spyOn(Events.prototype, 'trigger');
		v = new FullVaultMetrics();
	});

	afterEach(() => {
		triggerSpy.mockRestore();
	});

	test("without a batch, every mutation triggers", () => {
		v.inc(makeIncrement(1, 2));
		v.inc(makeIncrement(1, 3));
		v.setTags(5);
		expect(triggerSpy).toHaveBeenCalledTimes(3);
	});

	test("a batch coalesces all mutations into a single trigger", () => {
		v.beginBatch();
		v.inc(makeIncrement(1, 2));
		v.inc(makeIncrement(1, 3));
		v.setTags(5);
		v.setOrphans(2);
		v.setSourcesWithTrace(1);
		expect(triggerSpy).not.toHaveBeenCalled();
		v.endBatch();
		expect(triggerSpy).toHaveBeenCalledTimes(1);
		expect(triggerSpy).toHaveBeenCalledWith("updated");
	});

	test("an empty batch does not trigger", () => {
		v.beginBatch();
		v.endBatch();
		expect(triggerSpy).not.toHaveBeenCalled();
	});

	test("a batch with only no-op setters (same value) does not trigger", () => {
		v.beginBatch();
		v.setTags(0); // already 0
		v.setOrphans(0);
		v.endBatch();
		expect(triggerSpy).not.toHaveBeenCalled();
	});

	test("nested batches release on the outermost endBatch", () => {
		v.beginBatch();
		v.beginBatch();
		v.inc(makeIncrement(1, 2));
		v.endBatch();
		expect(triggerSpy).not.toHaveBeenCalled();
		v.endBatch();
		expect(triggerSpy).toHaveBeenCalledTimes(1);
	});

	test("aggregate state still mutates inside a batch (only the trigger is deferred)", () => {
		v.beginBatch();
		v.inc(makeIncrement(2, 5));
		expect(v.notes).toBe(2);
		expect(v.links).toBe(5);
		v.endBatch();
	});

	test("endBatch without a matching beginBatch is a no-op", () => {
		expect(() => v.endBatch()).not.toThrow();
		expect(triggerSpy).not.toHaveBeenCalled();
	});

	test("post-batch mutations resume firing immediately", () => {
		v.beginBatch();
		v.inc(makeIncrement(1, 2));
		v.endBatch();
		expect(triggerSpy).toHaveBeenCalledTimes(1);
		v.inc(makeIncrement(1, 2));
		expect(triggerSpy).toHaveBeenCalledTimes(2);
	});
});
