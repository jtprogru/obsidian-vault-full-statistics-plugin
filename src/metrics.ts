import { Events, EventRef } from 'obsidian';

export interface FullVaultMetrics {
	notes: number;
	links: number;
	quality: number;
}

export class FullVaultMetrics extends Events implements FullVaultMetrics {

	notes: number = 0;
	links: number = 0;
	quality: number = 0.00001;

	public reset() {
		this.notes = 0;
		this.links = 0;
		this.quality = 0.00001;
	}

	public dec(metrics: FullVaultMetrics | null) {
		this.notes -= metrics?.notes || 0;
		this.links -= metrics?.links || 0;
		this.quality = this.links / this.notes || 0.00001;
		this.trigger("updated");
	}

	public inc(metrics: FullVaultMetrics | null) {
		this.notes += metrics?.notes || 0;
		this.links += metrics?.links || 0;
		this.quality = this.links / this.notes || 0.00001;
		this.trigger("updated");
	}

	public on(name: "updated", callback: (vaultMetrics: FullVaultMetrics) => any, ctx?: any): EventRef {
		return super.on("updated", callback, ctx);
	}
}
