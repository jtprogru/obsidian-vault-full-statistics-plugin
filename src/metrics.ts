import { Events, EventRef } from 'obsidian';

export interface FullVaultMetrics {
	notes: number;
	links: number;
	tags: number;
	words: number;
	ownNotes: number;
	sourceNotes: number;
	conceptNotes: number;
	orphanNotes: number;
	sourcesWithTrace: number;
	quality: number;
}

export class FullVaultMetrics extends Events implements FullVaultMetrics {

	notes = 0;
	links = 0;
	tags = 0;
	words = 0;
	ownNotes = 0;
	sourceNotes = 0;
	conceptNotes = 0;
	orphanNotes = 0;
	sourcesWithTrace = 0;
	quality = 0.00001;

	private suspendDepth = 0;
	private dirty = false;

	public reset() {
		this.notes = 0;
		this.links = 0;
		this.tags = 0;
		this.words = 0;
		this.ownNotes = 0;
		this.sourceNotes = 0;
		this.conceptNotes = 0;
		this.orphanNotes = 0;
		this.sourcesWithTrace = 0;
		this.quality = 0.00001;
	}

	// Coalesce a flurry of mutations into a single 'updated' event. The
	// backlog batch invokes dec/inc/setTags/setOrphans/setSourcesWithTrace
	// dozens of times per tick; without this every listener's debounce timer
	// re-arms on every call. Nested batches are reference-counted so it's
	// safe to wrap from multiple call sites.
	public beginBatch() {
		this.suspendDepth++;
	}

	public endBatch() {
		if (this.suspendDepth === 0) return;
		this.suspendDepth--;
		if (this.suspendDepth === 0 && this.dirty) {
			this.dirty = false;
			super.trigger("updated");
		}
	}

	private fire() {
		if (this.suspendDepth > 0) {
			this.dirty = true;
			return;
		}
		super.trigger("updated");
	}

	public dec(metrics: FullVaultMetrics | null) {
		this.notes -= metrics?.notes || 0;
		this.links -= metrics?.links || 0;
		this.words -= metrics?.words || 0;
		this.ownNotes -= metrics?.ownNotes || 0;
		this.sourceNotes -= metrics?.sourceNotes || 0;
		this.conceptNotes -= metrics?.conceptNotes || 0;
		this.quality = this.links / this.notes || 0.00001;
		this.fire();
	}

	public inc(metrics: FullVaultMetrics | null) {
		this.notes += metrics?.notes || 0;
		this.links += metrics?.links || 0;
		this.words += metrics?.words || 0;
		this.ownNotes += metrics?.ownNotes || 0;
		this.sourceNotes += metrics?.sourceNotes || 0;
		this.conceptNotes += metrics?.conceptNotes || 0;
		this.quality = this.links / this.notes || 0.00001;
		this.fire();
	}

	public setTags(n: number) {
		if (this.tags === n) return;
		this.tags = n;
		this.fire();
	}

	public setOrphans(n: number) {
		if (this.orphanNotes === n) return;
		this.orphanNotes = n;
		this.fire();
	}

	public setSourcesWithTrace(n: number) {
		if (this.sourcesWithTrace === n) return;
		this.sourcesWithTrace = n;
		this.fire();
	}

	public tracePct(): number {
		return this.sourceNotes > 0 ? this.sourcesWithTrace / this.sourceNotes : 0;
	}

	public danglingSources(): number {
		return Math.max(0, this.sourceNotes - this.sourcesWithTrace);
	}

	public ownPct(): number {
		const classified = this.ownNotes + this.sourceNotes;
		return classified > 0 ? this.ownNotes / classified : 0;
	}

	public sourcePct(): number {
		const classified = this.ownNotes + this.sourceNotes;
		return classified > 0 ? this.sourceNotes / classified : 0;
	}

	public on(name: "updated", callback: (vaultMetrics: FullVaultMetrics) => any, ctx?: any): EventRef {
		// Obsidian's Events.on accepts a generic variadic callback; ours
		// publishes a narrower payload, hence the cast.
		return super.on("updated", callback as (...data: unknown[]) => unknown, ctx);
	}
}
