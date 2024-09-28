import { Events, EventRef } from 'obsidian';

export interface FullVaultMetrics {
	files: number;
	notes: number;
	attachments: number;
	size: number;
	links: number;
	words: number;
	quality: number;
	tags: number;
}

export class FullVaultMetrics extends Events implements FullVaultMetrics {

	files: number = 0;
	notes: number = 0;
	attachments: number = 0;
	size: number = 0;
	links: number = 0;
	words: number = 0;
	quality: number = 0.00001;
	tags: number = 0;

	public reset() {
		this.files = 0;
		this.notes = 0;
		this.attachments = 0;
		this.size = 0;
		this.links = 0;
		this.words = 0;
		this.quality = 0.00001;
		this.tags = 0;
	}

	public dec(metrics: FullVaultMetrics) {
		this.files -= metrics?.files || 0;
		this.notes -= metrics?.notes || 0;
		this.attachments -= metrics?.attachments || 0;
		this.size -= metrics?.size || 0;
		this.links -= metrics?.links || 0;
		this.words -= metrics?.words || 0;
		this.quality = this.links / this.notes || 0.00001;
		this.tags -= metrics?.tags || 0;
		this.trigger("updated");
	}

	public inc(metrics: FullVaultMetrics) {
		this.files += metrics?.files || 0;
		this.notes += metrics?.notes || 0;
		this.attachments += metrics?.attachments || 0;
		this.size += metrics?.size || 0;
		this.links += metrics?.links || 0;
		this.words += metrics?.words || 0;
		this.quality = this.links / this.notes || 0.00001;
		this.tags += metrics?.tags || 0;
		this.trigger("updated");
	}

	public on(name: "updated", callback: (vaultMetrics: FullVaultMetrics) => any, ctx?: any): EventRef {
		return super.on("updated", callback, ctx);
	}
}
