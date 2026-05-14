import { ItemView, WorkspaceLeaf, debounce, setIcon } from 'obsidian';
import { FullVaultMetrics } from './metrics';
import { FullVaultMetricsCollector } from './collect';
import { FullStatisticsPluginSettings } from './settings';
import { computeTangles, TangleEntry } from './tangles';

export const TANGLES_VIEW_TYPE = 'vault-full-statistics-tangles-view';

function basenameOf(path: string): string {
	const slash = path.lastIndexOf('/');
	const name = slash === -1 ? path : path.slice(slash + 1);
	return name.endsWith('.md') ? name.slice(0, -3) : name;
}

export class TanglesView extends ItemView {

	private readonly vaultMetrics: FullVaultMetrics;
	private readonly collector: FullVaultMetricsCollector;
	private readonly getSettings: () => FullStatisticsPluginSettings;
	private readonly onExclude: (path: string) => Promise<void>;

	constructor(
		leaf: WorkspaceLeaf,
		vaultMetrics: FullVaultMetrics,
		collector: FullVaultMetricsCollector,
		getSettings: () => FullStatisticsPluginSettings,
		onExclude: (path: string) => Promise<void>,
	) {
		super(leaf);
		this.vaultMetrics = vaultMetrics;
		this.collector = collector;
		this.getSettings = getSettings;
		this.onExclude = onExclude;
	}

	getViewType(): string {
		return TANGLES_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Vault tangles';
	}

	getIcon(): string {
		return 'network';
	}

	async onOpen(): Promise<void> {
		this.registerEvent(this.vaultMetrics.on('updated', this.renderSoon));
		this.render();
	}

	async onClose(): Promise<void> {
		// nothing to clean up — registerEvent handles unbind on view close.
	}

	private renderSoon = debounce(() => this.render(), 500, false);

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('vfs-view');

		const settings = this.getSettings();
		const section = contentEl.createDiv({ cls: 'vfs-section vfs-tangles' });
		section.createEl('h4', { text: 'Tangles', cls: 'vfs-section-title' });

		const entries = computeTangles(this.collector, settings);

		const meta = section.createDiv({ cls: 'vfs-tangles-meta' });
		meta.createSpan({
			cls: 'vfs-tangles-meta-mode',
			text: this.describeMode(settings),
		});
		meta.createSpan({
			cls: 'vfs-tangles-meta-count',
			text: `${entries.length} ${entries.length === 1 ? 'tangle' : 'tangles'}`,
		});

		if (entries.length === 0) {
			section.createDiv({
				cls: 'vfs-empty',
				text: 'No notes match the current tangle thresholds. Lower min in / min out in settings, or remove an exclude entry.',
			});
			return;
		}

		const legend = section.createDiv({ cls: 'vfs-tangles-legend' });
		this.appendLegendItem(legend, 'in', 'incoming');
		this.appendLegendItem(legend, 'out', 'outgoing');

		const list = section.createDiv({ cls: 'vfs-tangles-list' });
		for (const entry of entries) {
			this.appendTangleRow(list, entry);
		}
	}

	private describeMode(settings: FullStatisticsPluginSettings): string {
		if (settings.tanglesMode === 'sum') {
			return `sum · in+out ≥ ${settings.tanglesMinTotal}`;
		}
		const op = settings.tanglesMode === 'or' ? 'OR' : 'AND';
		return `${settings.tanglesMode} · in ≥ ${settings.tanglesMinIn} ${op} out ≥ ${settings.tanglesMinOut}`;
	}

	private appendLegendItem(parent: HTMLElement, kind: 'in' | 'out', label: string): void {
		const item = parent.createSpan({ cls: 'vfs-tangles-leg' });
		item.createSpan({ cls: `vfs-tangles-swatch vfs-tangles-swatch-${kind}` });
		item.createSpan({ cls: 'vfs-tangles-leg-text', text: label });
	}

	private appendTangleRow(parent: HTMLElement, entry: TangleEntry): void {
		const row = parent.createDiv({ cls: 'vfs-tangles-row' });

		const badge = row.createSpan({
			cls: 'vfs-tangles-badge',
			attr: { title: `${entry.inCount} incoming · ${entry.outCount} outgoing` },
		});
		badge.createSpan({ cls: 'vfs-tangles-badge-in', text: String(entry.inCount) });
		badge.createSpan({ cls: 'vfs-tangles-badge-out', text: String(entry.outCount) });

		// `internal-link` plugs into Obsidian's hover-preview/middle-click
		// handling; we still attach our own click handler so cmd-click opens
		// in a new leaf without us re-implementing tab logic.
		const link = row.createEl('a', {
			cls: 'vfs-tangles-link internal-link',
			text: basenameOf(entry.path),
			attr: {
				'data-href': entry.path,
				href: entry.path,
				title: entry.path,
			},
		});
		link.addEventListener('click', (evt) => {
			evt.preventDefault();
			const newLeaf = evt.metaKey || evt.ctrlKey || evt.button === 1;
			void this.app.workspace.openLinkText(entry.path, '', newLeaf);
		});
		link.addEventListener('auxclick', (evt) => {
			if (evt.button !== 1) return;
			evt.preventDefault();
			void this.app.workspace.openLinkText(entry.path, '', true);
		});

		const excludeBtn = row.createEl('button', {
			cls: 'clickable-icon vfs-tangles-exclude',
			attr: {
				'aria-label': 'Exclude from tangles',
				title: 'Exclude from tangles',
			},
		});
		setIcon(excludeBtn, 'x');
		excludeBtn.addEventListener('click', (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			void this.onExclude(entry.path);
		});
	}
}
