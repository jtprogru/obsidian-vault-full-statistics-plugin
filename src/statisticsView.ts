import { ItemView, WorkspaceLeaf, debounce } from 'obsidian';
import { FullVaultMetrics } from './metrics';
import { FullVaultMetricsCollector, GroupAggregate } from './collect';
import { HistoryStore, pctString } from './historyStore';
import { FullStatisticsPluginSettings } from './settings';
import { findRareTags, findUnknownTags, normalizeCanonical, TagFinding } from './taxonomy';

const TAXONOMY_TAG_LIMIT = 20;

export const VAULT_STATISTICS_VIEW_TYPE = 'vault-full-statistics-view';

export class VaultStatisticsView extends ItemView {

	private readonly vaultMetrics: FullVaultMetrics;
	private readonly collector: FullVaultMetricsCollector;
	private readonly historyStore: HistoryStore;
	private readonly getSettings: () => FullStatisticsPluginSettings;

	constructor(
		leaf: WorkspaceLeaf,
		vaultMetrics: FullVaultMetrics,
		collector: FullVaultMetricsCollector,
		historyStore: HistoryStore,
		getSettings: () => FullStatisticsPluginSettings,
	) {
		super(leaf);
		this.vaultMetrics = vaultMetrics;
		this.collector = collector;
		this.historyStore = historyStore;
		this.getSettings = getSettings;
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
		this.registerEvent(this.vaultMetrics.on('updated', this.renderSoon));
		this.render();
	}

	async onClose(): Promise<void> {
		// nothing to clean up — registerEvent handles unbind on view close.
	}

	// Mild debounce so a flurry of metric updates during the initial
	// vault scan does not trigger one re-render per file event.
	private renderSoon = debounce(() => this.render(), 500, false);

	private render(): void {
		// Refresh the orphan count synchronously so the view never shows a
		// number stale from the 1s debounced background pass. setOrphans is
		// no-op-aware, so propagating the fresh value to status bar/history
		// does not loop.
		this.vaultMetrics.setOrphans(this.collector.computeOrphanCount());

		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('vfs-view');

		this.renderHero(contentEl);
		this.renderRatio(contentEl);
		this.renderSecondaryGrid(contentEl);
		this.renderFolders(contentEl);
		this.renderTaxonomy(contentEl);
		this.renderHistory(contentEl);
	}

	private renderTaxonomy(parent: HTMLElement): void {
		const settings = this.getSettings();
		if (!settings.showTaxonomyDrift) return;

		const occurrences = this.collector.getTagOccurrences();
		if (Object.keys(occurrences).length === 0) return;

		const canonical = normalizeCanonical(settings.canonicalTags);
		const rare = findRareTags(occurrences, settings.rareTagThreshold);
		const unknown = findUnknownTags(occurrences, canonical);

		const section = parent.createDiv({ cls: 'vfs-section vfs-taxonomy' });
		section.createEl('h4', { text: 'Tag taxonomy', cls: 'vfs-section-title' });

		this.appendTaxonomyGroup(
			section,
			`Rare (<${settings.rareTagThreshold})`,
			rare,
			'Tags used fewer than the configured threshold — likely typos or abandoned',
			'Every tag passes the rare-tag threshold.',
		);

		this.appendTaxonomyGroup(
			section,
			'Unknown',
			unknown,
			'Tags not present in your canonical set (configure it in settings)',
			canonical.size === 0
				? 'Configure canonical tags in settings to flag unknown tags.'
				: 'Every tag is in your canonical set.',
		);
	}

	private appendTaxonomyGroup(
		parent: HTMLElement,
		label: string,
		findings: TagFinding[],
		tooltip: string,
		emptyText: string,
	): void {
		const group = parent.createDiv({ cls: 'vfs-tax-group' });
		const header = group.createDiv({ cls: 'vfs-tax-head' });
		header.setAttribute('title', tooltip);
		header.createSpan({ cls: 'vfs-tax-label', text: label });
		header.createSpan({ cls: 'vfs-tax-count', text: String(findings.length) });

		if (findings.length === 0) {
			group.createDiv({ cls: 'vfs-empty', text: emptyText });
			return;
		}

		const list = group.createDiv({ cls: 'vfs-tax-list' });
		const visible = findings.slice(0, TAXONOMY_TAG_LIMIT);
		for (const f of visible) {
			const pill = list.createSpan({ cls: 'vfs-tax-pill' });
			pill.createSpan({ cls: 'vfs-tax-tag', text: `#${f.tag}` });
			pill.createSpan({ cls: 'vfs-tax-num', text: String(f.count) });
		}
		const overflow = findings.length - visible.length;
		if (overflow > 0) {
			list.createSpan({ cls: 'vfs-tax-more', text: `+${overflow} more` });
		}
	}

	private renderFolders(parent: HTMLElement): void {
		const settings = this.getSettings();
		if (!settings.showFolderBreakdown) return;
		const groups = settings.folderGroups;
		if (!groups || groups.length === 0) return;

		const aggregates = this.collector.aggregateByGroups(groups);
		const maxNotes = aggregates.reduce((acc, a) => Math.max(acc, a.notes), 0);
		if (maxNotes === 0) return;

		const section = parent.createDiv({ cls: 'vfs-section vfs-folders' });
		section.createEl('h4', { text: 'Folder breakdown', cls: 'vfs-section-title' });

		const list = section.createDiv({ cls: 'vfs-folder-list' });
		for (const a of aggregates) {
			this.appendFolder(list, a);
		}
	}

	private appendFolder(parent: HTMLElement, a: GroupAggregate): void {
		// display: contents on .vfs-folder lets each row's children
		// participate directly in the parent grid — single visual line per
		// group with aligned columns across all rows.
		const row = parent.createDiv({ cls: 'vfs-folder' });
		row.createSpan({ cls: 'vfs-folder-name', text: a.name });
		row.createSpan({
			cls: 'vfs-folder-count',
			text: a.notes.toLocaleString('en-US'),
		});

		const bar = row.createDiv({ cls: 'vfs-folder-bar' });
		const classified = a.ownNotes + a.sourceNotes;
		if (classified > 0) {
			const ownSeg = bar.createDiv({ cls: 'vfs-folder-bar-own' });
			ownSeg.style.flexGrow = String(a.ownNotes);
			const srcSeg = bar.createDiv({ cls: 'vfs-folder-bar-source' });
			srcSeg.style.flexGrow = String(a.sourceNotes);
			const remainder = a.notes - classified;
			if (remainder > 0) {
				const restSeg = bar.createDiv({ cls: 'vfs-folder-bar-rest' });
				restSeg.style.flexGrow = String(remainder);
			}
			row.createSpan({
				cls: 'vfs-folder-pct',
				text: pctString(a.ownNotes / classified),
				title: `${a.ownNotes} own · ${a.sourceNotes} source`,
			});
		} else {
			// Nothing classified — show just the unclassified bar so the
			// row keeps the same visual weight as classified groups.
			const restSeg = bar.createDiv({ cls: 'vfs-folder-bar-rest' });
			restSeg.style.flexGrow = '1';
			row.createSpan({ cls: 'vfs-folder-pct vfs-folder-pct-empty', text: '—' });
		}
	}

	private renderHero(parent: HTMLElement): void {
		const hero = parent.createDiv({ cls: 'vfs-hero' });
		this.appendHeroStat(hero, this.vaultMetrics.notes.toLocaleString('en-US'), 'notes');
		this.appendHeroStat(
			hero,
			this.vaultMetrics.quality.toFixed(2),
			'QoV',
			'Quality of Vault — average number of links per note',
		);
	}

	private appendHeroStat(parent: HTMLElement, value: string, label: string, tooltip?: string): void {
		const stat = parent.createDiv({ cls: 'vfs-hero-stat' });
		if (tooltip) stat.setAttribute('title', tooltip);
		stat.createDiv({ cls: 'vfs-hero-value', text: value });
		stat.createDiv({ cls: 'vfs-hero-label', text: label });
	}

	private renderRatio(parent: HTMLElement): void {
		const m = this.vaultMetrics;
		const own = m.ownNotes;
		const source = m.sourceNotes;
		const concept = m.conceptNotes;
		const total = own + source + concept;

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
		this.appendRatioSegment(bar, 'vfs-ratio-own', own);
		this.appendRatioSegment(bar, 'vfs-ratio-source', source);
		this.appendRatioSegment(bar, 'vfs-ratio-concept', concept);

		const legend = section.createDiv({ cls: 'vfs-ratio-legend' });
		const classified = own + source;
		this.appendLegend(legend, 'own', own, classified > 0 ? own / classified : 0, true);
		this.appendLegend(legend, 'source', source, classified > 0 ? source / classified : 0, true);
		if (concept > 0) {
			// Concept share is computed against the full classified set so it
			// communicates "this much of your tagged corpus is grey zone".
			this.appendLegend(legend, 'concept', concept, concept / total, false);
		}
	}

	private appendRatioSegment(bar: HTMLElement, cls: string, value: number): void {
		if (value <= 0) return;
		const seg = bar.createDiv({ cls });
		seg.style.flexGrow = String(value);
	}

	private appendLegend(parent: HTMLElement, kind: 'own' | 'source' | 'concept', count: number, share: number, showPct: boolean): void {
		const item = parent.createSpan({ cls: `vfs-ratio-leg vfs-ratio-leg-${kind}` });
		item.createSpan({ cls: `vfs-ratio-swatch vfs-ratio-swatch-${kind}` });
		const label = showPct ? `${pctString(share)} ${kind} · ${count}` : `${count} ${kind}`;
		item.createSpan({ cls: 'vfs-ratio-leg-text', text: label });
	}

	private renderSecondaryGrid(parent: HTMLElement): void {
		const section = parent.createDiv({ cls: 'vfs-section vfs-grid-section' });
		section.createEl('h4', { text: 'Metrics', cls: 'vfs-section-title' });

		const grid = section.createDiv({ cls: 'vfs-grid' });
		const m = this.vaultMetrics;
		this.appendStat(grid, m.links.toLocaleString('en-US'), 'links');
		this.appendStat(grid, m.tags.toLocaleString('en-US'), 'tags');
		this.appendStat(grid, m.conceptNotes.toLocaleString('en-US'), 'concepts');
		this.appendStat(
			grid,
			m.orphanNotes.toLocaleString('en-US'),
			'orphans',
			'Notes nothing else links to',
		);
	}

	private appendStat(parent: HTMLElement, value: string, label: string, tooltip?: string): void {
		const stat = parent.createDiv({ cls: 'vfs-stat' });
		if (tooltip) stat.setAttribute('title', tooltip);
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

		const grid = section.createDiv({ cls: 'vfs-spark-grid' });
		this.appendSparkRow(grid, 'notes', snapshots.map(s => s.notes), 'vfs-bars-notes');
		this.appendSparkRow(grid, 'own', snapshots.map(s => s.ownNotes), 'vfs-bars-own');
		this.appendSparkRow(grid, 'source', snapshots.map(s => s.sourceNotes), 'vfs-bars-source');
		this.appendSparkRow(grid, 'links', snapshots.map(s => s.links), 'vfs-bars-neutral');
		this.appendSparkRow(grid, 'tags', snapshots.map(s => s.tags), 'vfs-bars-neutral');
		this.appendSparkRow(grid, 'orphans', snapshots.map(s => s.orphanNotes ?? 0), 'vfs-bars-warn');

		const first = snapshots[0];
		const last = snapshots[snapshots.length - 1];
		const delta = last.notes - first.notes;
		const sign = delta > 0 ? '+' : '';
		const deltaCls = delta > 0 ? 'vfs-delta-pos' : (delta < 0 ? 'vfs-delta-neg' : 'vfs-delta-flat');
		const footer = section.createDiv({ cls: 'vfs-history-footer' });
		footer.createSpan({ cls: `vfs-delta ${deltaCls}`, text: `${sign}${delta} notes` });
		footer.createSpan({ cls: 'vfs-history-range', text: ` since ${first.date}` });
	}

	private appendSparkRow(parent: HTMLElement, label: string, values: number[], colorCls: string): void {
		parent.createDiv({ cls: 'vfs-spark-label', text: label });

		const barsEl = parent.createDiv({ cls: `vfs-bars ${colorCls}` });
		let min = values[0];
		let max = values[0];
		for (const v of values) {
			if (v < min) min = v;
			if (v > max) max = v;
		}
		const range = max - min;
		for (const v of values) {
			const bar = barsEl.createDiv({ cls: 'vfs-bar' });
			// Always show a baseline so flat zero series remain visible;
			// otherwise scale the bar height across the local range.
			const ratio = range === 0 ? 0.4 : 0.15 + (0.85 * (v - min) / range);
			bar.style.height = `${Math.round(ratio * 100)}%`;
			bar.setAttribute('title', `${v.toLocaleString('en-US')}`);
		}

		const tail = values[values.length - 1];
		parent.createDiv({ cls: 'vfs-spark-tail', text: tail.toLocaleString('en-US') });
	}
}
