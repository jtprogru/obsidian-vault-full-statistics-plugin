import { Events, EventRef } from 'obsidian';

export interface FullVaultMetrics {
	notes: number;
	links: number;
	tags: number;
	ownNotes: number;
	sourceNotes: number;
	conceptNotes: number;
	orphanNotes: number;
	quality: number;
}

export class FullVaultMetrics extends Events implements FullVaultMetrics {

	notes: number = 0;
	links: number = 0;
	tags: number = 0;
	ownNotes: number = 0;
	sourceNotes: number = 0;
	conceptNotes: number = 0;
	orphanNotes: number = 0;
	quality: number = 0.00001;

	public reset() {
		this.notes = 0;
		this.links = 0;
		this.tags = 0;
		this.ownNotes = 0;
		this.sourceNotes = 0;
		this.conceptNotes = 0;
		this.orphanNotes = 0;
		this.quality = 0.00001;
	}

	public dec(metrics: FullVaultMetrics | null) {
		this.notes -= metrics?.notes || 0;
		this.links -= metrics?.links || 0;
		this.ownNotes -= metrics?.ownNotes || 0;
		this.sourceNotes -= metrics?.sourceNotes || 0;
		this.conceptNotes -= metrics?.conceptNotes || 0;
		this.quality = this.links / this.notes || 0.00001;
		this.trigger("updated");
	}

	public inc(metrics: FullVaultMetrics | null) {
		this.notes += metrics?.notes || 0;
		this.links += metrics?.links || 0;
		this.ownNotes += metrics?.ownNotes || 0;
		this.sourceNotes += metrics?.sourceNotes || 0;
		this.conceptNotes += metrics?.conceptNotes || 0;
		this.quality = this.links / this.notes || 0.00001;
		this.trigger("updated");
	}

	public setTags(n: number) {
		if (this.tags === n) return;
		this.tags = n;
		this.trigger("updated");
	}

	public setOrphans(n: number) {
		if (this.orphanNotes === n) return;
		this.orphanNotes = n;
		this.trigger("updated");
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
		return super.on("updated", callback, ctx);
	}
}
