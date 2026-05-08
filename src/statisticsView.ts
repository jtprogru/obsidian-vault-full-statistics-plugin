import { ItemView, WorkspaceLeaf } from 'obsidian';
import { FullVaultMetrics } from './metrics';
import { HistoryStore, sparkline, pctString } from './historyStore';

export const VAULT_STATISTICS_VIEW_TYPE = 'vault-full-statistics-view';

export class VaultStatisticsView extends ItemView {

	private readonly vaultMetrics: FullVaultMetrics;
	private readonly historyStore: HistoryStore;

	constructor(leaf: WorkspaceLeaf, vaultMetrics: FullVaultMetrics, historyStore: HistoryStore) {
		super(leaf);
		this.vaultMetrics = vaultMetrics;
		this.historyStore = historyStore;
	}

	getViewType(): string {
		return VAULT_STATISTICS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Vault statistics';
	}

	getIcon(): string {
		return 'bar-chart';
	}

	async onOpen(): Promise<void> {
		this.registerEvent(this.vaultMetrics.on('updated', () => this.render()));
		this.render();
	}

	async onClose(): Promise<void> {
		// nothing to clean up — registerEvent handles unbind on view close.
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('vault-full-statistics-view');

		contentEl.createEl('h3', { text: 'Vault statistics' });

		const m = this.vaultMetrics;
		const list = contentEl.createEl('ul');
		this.appendItem(list, 'Notes', m.notes.toLocaleString('en-US'));
		this.appendItem(list, 'Links', m.links.toLocaleString('en-US'));
		this.appendItem(list, 'Tags (distinct)', m.tags.toLocaleString('en-US'));
		this.appendItem(list, 'Quality (links/note)', m.quality.toFixed(2));
		this.appendItem(list, 'Own', `${m.ownNotes} (${pctString(m.ownPct())})`);
		this.appendItem(list, 'Source', `${m.sourceNotes} (${pctString(m.sourcePct())})`);
		this.appendItem(list, 'Concepts', `${m.conceptNotes}`);

		const snapshots = this.historyStore.recent(30);
		if (snapshots.length >= 2) {
			contentEl.createEl('h4', { text: `Last ${snapshots.length} day(s)` });

			const sparkSection = contentEl.createDiv({ cls: 'vault-full-statistics-sparks' });
			this.appendSpark(sparkSection, 'notes', snapshots.map(s => s.notes));
			this.appendSpark(sparkSection, 'own', snapshots.map(s => s.ownNotes));
			this.appendSpark(sparkSection, 'source', snapshots.map(s => s.sourceNotes));
			this.appendSpark(sparkSection, 'tags', snapshots.map(s => s.tags));
			this.appendSpark(sparkSection, 'links', snapshots.map(s => s.links));

			const last = snapshots[snapshots.length - 1];
			const first = snapshots[0];
			const delta = last.notes - first.notes;
			const sign = delta >= 0 ? '+' : '';
			contentEl.createEl('p', {
				text: `Notes change since ${first.date}: ${sign}${delta}`,
				cls: 'vault-full-statistics-delta',
			});
		} else {
			contentEl.createEl('p', {
				text: 'History will appear after a few daily snapshots.',
				cls: 'vault-full-statistics-empty',
			});
		}
	}

	private appendItem(list: HTMLElement, label: string, value: string): void {
		const li = list.createEl('li');
		li.createSpan({ text: `${label}: `, cls: 'vault-full-statistics-label' });
		li.createSpan({ text: value, cls: 'vault-full-statistics-value' });
	}

	private appendSpark(parent: HTMLElement, label: string, values: number[]): void {
		const row = parent.createDiv({ cls: 'vault-full-statistics-spark-row' });
		row.createSpan({ text: `${label.padEnd(7)} `, cls: 'vault-full-statistics-spark-label' });
		const spark = row.createSpan({ text: sparkline(values), cls: 'vault-full-statistics-spark' });
		spark.style.fontFamily = 'monospace';
		const last = values[values.length - 1];
		row.createSpan({ text: ` ${last}`, cls: 'vault-full-statistics-spark-tail' });
	}
}
