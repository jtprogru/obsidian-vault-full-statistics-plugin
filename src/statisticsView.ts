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
		contentEl.addClass('vfs-view');

		this.renderHero(contentEl);
		this.renderRatio(contentEl);
		this.renderSecondaryGrid(contentEl);
		this.renderHistory(contentEl);
	}

	private renderHero(parent: HTMLElement): void {
		const hero = parent.createDiv({ cls: 'vfs-hero' });
		hero.createDiv({
			cls: 'vfs-hero-value',
			text: this.vaultMetrics.notes.toLocaleString('en-US'),
		});
		hero.createDiv({ cls: 'vfs-hero-label', text: 'notes in vault' });
	}

	private renderRatio(parent: HTMLElement): void {
		const m = this.vaultMetrics;
		const own = m.ownNotes;
		const source = m.sourceNotes;
		const total = own + source;

		const section = parent.createDiv({ cls: 'vfs-section vfs-ratio' });
		section.createEl('h4', { text: 'Own vs source', cls: 'vfs-section-title' });

		if (total === 0) {
			section.createDiv({
				cls: 'vfs-empty',
				text: 'No notes classified yet — tag some notes (see settings).',
			});
			return;
		}

		const bar = section.createDiv({ cls: 'vfs-ratio-bar' });
		const ownSeg = bar.createDiv({ cls: 'vfs-ratio-own' });
		ownSeg.style.flexGrow = String(own);
		const sourceSeg = bar.createDiv({ cls: 'vfs-ratio-source' });
		sourceSeg.style.flexGrow = String(source);

		const legend = section.createDiv({ cls: 'vfs-ratio-legend' });
		const ownLeg = legend.createDiv({ cls: 'vfs-ratio-leg vfs-ratio-leg-own' });
		ownLeg.createSpan({ cls: 'vfs-ratio-swatch vfs-ratio-swatch-own' });
		ownLeg.createSpan({ cls: 'vfs-ratio-leg-text', text: `${pctString(m.ownPct())} own · ${own}` });

		const srcLeg = legend.createDiv({ cls: 'vfs-ratio-leg vfs-ratio-leg-source' });
		srcLeg.createSpan({ cls: 'vfs-ratio-swatch vfs-ratio-swatch-source' });
		srcLeg.createSpan({ cls: 'vfs-ratio-leg-text', text: `${pctString(m.sourcePct())} source · ${source}` });

		if (m.conceptNotes > 0) {
			section.createDiv({
				cls: 'vfs-ratio-concepts',
				text: `+${m.conceptNotes} concept note${m.conceptNotes === 1 ? '' : 's'} (grey zone)`,
			});
		}
	}

	private renderSecondaryGrid(parent: HTMLElement): void {
		const section = parent.createDiv({ cls: 'vfs-section vfs-grid-section' });
		section.createEl('h4', { text: 'Metrics', cls: 'vfs-section-title' });

		const grid = section.createDiv({ cls: 'vfs-grid' });
		const m = this.vaultMetrics;
		this.appendStat(grid, m.links.toLocaleString('en-US'), 'links');
		this.appendStat(grid, m.tags.toLocaleString('en-US'), 'tags');
		this.appendStat(grid, m.quality.toFixed(2), 'links/note');
		this.appendStat(grid, m.conceptNotes.toLocaleString('en-US'), 'concepts');
	}

	private appendStat(parent: HTMLElement, value: string, label: string): void {
		const stat = parent.createDiv({ cls: 'vfs-stat' });
		stat.createDiv({ cls: 'vfs-stat-value', text: value });
		stat.createDiv({ cls: 'vfs-stat-label', text: label });
	}

	private renderHistory(parent: HTMLElement): void {
		const section = parent.createDiv({ cls: 'vfs-section vfs-history' });
		const snapshots = this.historyStore.recent(30);

		if (snapshots.length < 2) {
			section.createEl('h4', { text: 'History', cls: 'vfs-section-title' });
			section.createDiv({
				cls: 'vfs-empty',
				text: snapshots.length === 0
					? 'First snapshot will appear once today\'s metrics settle.'
					: 'One day recorded so far. A trend will show after a second daily snapshot.',
			});
			return;
		}

		section.createEl('h4', {
			text: `Last ${snapshots.length} day${snapshots.length === 1 ? '' : 's'}`,
			cls: 'vfs-section-title',
		});

		const table = section.createEl('table', { cls: 'vfs-spark-table' });
		this.appendSparkRow(table, 'notes', snapshots.map(s => s.notes));
		this.appendSparkRow(table, 'own', snapshots.map(s => s.ownNotes));
		this.appendSparkRow(table, 'source', snapshots.map(s => s.sourceNotes));
		this.appendSparkRow(table, 'links', snapshots.map(s => s.links));
		this.appendSparkRow(table, 'tags', snapshots.map(s => s.tags));

		const first = snapshots[0];
		const last = snapshots[snapshots.length - 1];
		const delta = last.notes - first.notes;
		const sign = delta > 0 ? '+' : '';
		const deltaCls = delta > 0 ? 'vfs-delta-pos' : (delta < 0 ? 'vfs-delta-neg' : 'vfs-delta-flat');
		const footer = section.createDiv({ cls: 'vfs-history-footer' });
		footer.createSpan({ cls: `vfs-delta ${deltaCls}`, text: `${sign}${delta} notes` });
		footer.createSpan({ cls: 'vfs-history-range', text: ` since ${first.date}` });
	}

	private appendSparkRow(table: HTMLElement, label: string, values: number[]): void {
		const row = table.createEl('tr');
		row.createEl('td', { cls: 'vfs-spark-label', text: label });
		row.createEl('td', { cls: 'vfs-spark-cell', text: sparkline(values) });
		const tail = values[values.length - 1];
		row.createEl('td', { cls: 'vfs-spark-tail', text: tail.toLocaleString('en-US') });
	}
}
