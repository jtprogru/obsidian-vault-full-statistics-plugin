import { ItemView, WorkspaceLeaf, debounce } from 'obsidian';
import { FullVaultMetrics } from './metrics';
import { FullVaultMetricsCollector, GroupAggregate } from './collect';
import { HistoryStore, pctString } from './historyStore';
import { FullStatisticsPluginSettings } from './settings';
import { findRareTags, findUnknownTags, normalizeCanonical, TagFinding } from './taxonomy';
import { InboxBucket } from './inbox';

const TAXONOMY_TAG_LIMIT = 10;
const TRACE_LIST_LIMIT = 5;

function basenameOf(path: string): string {
	const slash = path.lastIndexOf('/');
	const name = slash === -1 ? path : path.slice(slash + 1);
	return name.endsWith('.md') ? name.slice(0, -3) : name;
}

// Compact form keeps the hero value short enough to share width with notes
// and QoV even on million-word vaults: 9,999 stays full; 10,000+ becomes
// "12K" / "1.2M". Exact value is offered via tooltip.
const COMPACT_FORMATTER = new Intl.NumberFormat('en-US', {
	notation: 'compact',
	maximumFractionDigits: 1,
});

function formatCompactNumber(n: number): string {
	if (Math.abs(n) < 10_000) return n.toLocaleString('en-US');
	return COMPACT_FORMATTER.format(n);
}

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
		// Orphan and sources-with-trace counts are now refreshed at the end
		// of every backlog batch (see FullVaultMetricsCollector.processBacklog),
		// so vaultMetrics.orphanNotes / sourcesWithTrace are already current
		// by the time the 500 ms render debounce fires.
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('vfs-view');

		this.renderHero(contentEl);
		this.renderRatio(contentEl);
		this.renderSecondaryGrid(contentEl);
		this.renderSourcesTrace(contentEl);
		this.renderInbox(contentEl);
		this.renderFolders(contentEl);
		this.renderTaxonomy(contentEl);
		this.renderHistory(contentEl);
	}

	private renderInbox(parent: HTMLElement): void {
		const settings = this.getSettings();
		if (!settings.showInbox) return;

		const section = parent.createDiv({ cls: 'vfs-section vfs-inbox' });
		section.createEl('h4', { text: 'Inbox health', cls: 'vfs-section-title' });

		const hasFolders = settings.inboxFolders.length > 0;
		const hasTags = settings.inboxReviewTags.length > 0;
		if (!hasFolders && !hasTags) {
			section.createDiv({
				cls: 'vfs-empty',
				text: 'Configure inbox folders or review tags in settings to see this section.',
			});
			return;
		}

		const { inFolder, outsideWithTag } = this.collector.computeInboxHealth(new Date());

		if (hasFolders) {
			const label = settings.inboxFolders.length === 1
				? settings.inboxFolders[0]
				: `${settings.inboxFolders.length} inbox folders`;
			this.appendInboxRow(section, label, inFolder);
		}
		if (hasTags) {
			const label = settings.inboxReviewTags.length === 1
				? `#${settings.inboxReviewTags[0]} (outside inbox)`
				: `${settings.inboxReviewTags.length} review tags (outside inbox)`;
			this.appendInboxRow(section, label, outsideWithTag);
		}
	}

	private appendInboxRow(parent: HTMLElement, label: string, bucket: InboxBucket): void {
		const row = parent.createDiv({ cls: 'vfs-inbox-row' });

		const head = row.createDiv({ cls: 'vfs-inbox-head' });
		head.createSpan({ cls: 'vfs-inbox-label', text: label });
		head.createSpan({ cls: 'vfs-inbox-total', text: String(bucket.total) });
		if (bucket.old > 0) {
			head.createSpan({
				cls: 'vfs-inbox-old',
				text: `${bucket.old} over 30d`,
				attr: { title: 'Notes older than 30 days — actionable backlog' },
			});
		}

		if (bucket.total === 0) {
			row.createDiv({ cls: 'vfs-empty', text: 'Empty.' });
			return;
		}

		const bar = row.createDiv({ cls: 'vfs-inbox-bar' });
		this.appendInboxSegment(bar, 'fresh', bucket.fresh);
		this.appendInboxSegment(bar, 'recent', bucket.recent);
		this.appendInboxSegment(bar, 'stale', bucket.stale);
		this.appendInboxSegment(bar, 'old', bucket.old);

		const legend = row.createDiv({ cls: 'vfs-inbox-legend' });
		this.appendInboxLegend(legend, 'fresh', '<1d', bucket.fresh);
		this.appendInboxLegend(legend, 'recent', '1–7d', bucket.recent);
		this.appendInboxLegend(legend, 'stale', '7–30d', bucket.stale);
		this.appendInboxLegend(legend, 'old', '30+d', bucket.old);
	}

	private appendInboxSegment(bar: HTMLElement, kind: string, value: number): void {
		if (value <= 0) return;
		const seg = bar.createDiv({ cls: `vfs-inbox-seg vfs-inbox-seg-${kind}` });
		seg.style.flexGrow = String(value);
	}

	private appendInboxLegend(parent: HTMLElement, kind: string, label: string, count: number): void {
		const item = parent.createSpan({ cls: `vfs-inbox-leg vfs-inbox-leg-${kind}` });
		item.createSpan({ cls: `vfs-inbox-swatch vfs-inbox-swatch-${kind}` });
		item.createSpan({ cls: 'vfs-inbox-leg-text', text: `${label} ${count}` });
	}

	private renderSourcesTrace(parent: HTMLElement): void {
		const settings = this.getSettings();
		if (!settings.showSourcesTrace) return;

		const total = this.vaultMetrics.sourceNotes;
		const section = parent.createDiv({ cls: 'vfs-section vfs-trace' });
		section.createEl('h4', { text: 'Sources with trace', cls: 'vfs-section-title' });

		if (total === 0) {
			section.createDiv({
				cls: 'vfs-empty',
				text: 'No source notes yet — tag notes about external material with a source tag.',
			});
			return;
		}

		// withTrace is kept fresh by the batch-tail refresh; we still need
		// the `dangling` list (paths) for the UI, which only this call
		// provides. PR 3 will memoize this so re-renders are cheap.
		const { withTrace, dangling } = this.collector.computeSourcesTrace();
		const danglingCount = total - withTrace;

		const bar = section.createDiv({ cls: 'vfs-trace-bar' });
		this.appendTraceSegment(bar, 'vfs-trace-bar-good', withTrace);
		this.appendTraceSegment(bar, 'vfs-trace-bar-bad', danglingCount);

		const legend = section.createDiv({ cls: 'vfs-trace-legend' });
		this.appendTraceLegend(legend, 'good', withTrace, total > 0 ? withTrace / total : 0, 'traced');
		this.appendTraceLegend(legend, 'bad', danglingCount, total > 0 ? danglingCount / total : 0, 'dangling');

		if (settings.showDanglingList && dangling.length > 0) {
			const list = section.createDiv({ cls: 'vfs-trace-list' });
			const visible = dangling.slice(0, TRACE_LIST_LIMIT);
			for (const path of visible) {
				this.appendDanglingLink(list, path);
			}
			const overflow = dangling.length - visible.length;
			if (overflow > 0) {
				list.createSpan({ cls: 'vfs-trace-more', text: `+${overflow} more` });
			}
		}
	}

	private appendDanglingLink(parent: HTMLElement, path: string): void {
		// Use `internal-link` so Obsidian's hover preview hooks fire and the
		// link gets the same affordance as other note links throughout the
		// app. data-href + href both point at the resolved path; the click
		// handler defers to openLinkText so cmd/middle-click opens in a new
		// tab without us re-implementing tab logic.
		const link = parent.createEl('a', {
			cls: 'vfs-trace-pill internal-link',
			text: basenameOf(path),
			attr: {
				'data-href': path,
				href: path,
				title: path,
			},
		});
		link.addEventListener('click', (evt) => {
			evt.preventDefault();
			const newLeaf = evt.metaKey || evt.ctrlKey || evt.button === 1;
			this.app.workspace.openLinkText(path, '', newLeaf);
		});
		link.addEventListener('auxclick', (evt) => {
			if (evt.button !== 1) return;
			evt.preventDefault();
			this.app.workspace.openLinkText(path, '', true);
		});
	}

	private appendTraceSegment(bar: HTMLElement, cls: string, value: number): void {
		if (value <= 0) return;
		const seg = bar.createDiv({ cls });
		seg.style.flexGrow = String(value);
	}

	private appendTraceLegend(parent: HTMLElement, kind: 'good' | 'bad', count: number, share: number, label: string): void {
		const item = parent.createSpan({ cls: `vfs-trace-leg vfs-trace-leg-${kind}` });
		item.createSpan({ cls: `vfs-trace-swatch vfs-trace-swatch-${kind}` });
		item.createSpan({ cls: 'vfs-trace-leg-text', text: `${pctString(share)} ${label} · ${count}` });
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
			formatCompactNumber(this.vaultMetrics.words),
			'words',
			`Total words across the vault: ${this.vaultMetrics.words.toLocaleString('en-US')}`,
		);
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
		if (!this.getSettings().showHistory) return;

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
		this.appendSparkRow(grid, 'traced', snapshots.map(s => s.sourcesWithTrace ?? 0), 'vfs-bars-source');

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
