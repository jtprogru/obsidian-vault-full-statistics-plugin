import { Component, MetadataCache, TFile } from 'obsidian';
import FullStatisticsPlugin from './main';
import { FullVaultMetricsCollector } from './collect';
import { FullVaultMetrics } from './metrics';
import { DEFAULT_SETTINGS } from './settings';
import { HistoryStore } from './historyStore';

jest.mock('obsidian', () => ({
	...jest.requireActual('./__mocks__/obsidian'),
	Plugin: class {},
	debounce: (callback: unknown) => callback,
}));
jest.mock('./statisticsView', () => ({ VAULT_STATISTICS_VIEW_TYPE: 'statistics' }));
jest.mock('./tanglesView', () => ({ TANGLES_VIEW_TYPE: 'tangles' }));

function makePlugin(raw: unknown) {
	const plugin = Object.create(FullStatisticsPlugin.prototype) as FullStatisticsPlugin;
	plugin.loadData = jest.fn().mockResolvedValue(raw);
	plugin.saveData = jest.fn().mockResolvedValue(undefined);
	return plugin;
}

describe('embedded link setting persistence', () => {
	test.each([
		['legacy without key', {}, true],
		['wrapped without key', { settings: {}, history: [] }, true],
		['legacy false', { countEmbeddedLinks: false }, false],
		['wrapped false', { settings: { countEmbeddedLinks: false }, history: [] }, false],
		['legacy true', { countEmbeddedLinks: true }, true],
		['wrapped true', { settings: { countEmbeddedLinks: true }, history: [] }, true],
	] as const)('%s loads and survives saving', async (_label, raw, expected) => {
		const plugin = makePlugin(raw);
		await plugin.loadSettings();
		expect(plugin.settings.countEmbeddedLinks).toBe(expected);
		await plugin.saveSettings();
		const saved = (plugin.saveData as jest.Mock).mock.calls[0][0];
		expect(saved).toMatchObject({ settings: { countEmbeddedLinks: expected }, history: [] });
		const reloaded = makePlugin(saved);
		await reloaded.loadSettings();
		expect(reloaded.settings.countEmbeddedLinks).toBe(expected);
	});
});

describe('embedded link vault rescan', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
	});
	afterEach(() => {
		jest.useRealTimers();
		Reflect.deleteProperty(globalThis, 'window');
	});

	test('restart propagates both modes through vault, folder and history totals without changing graph metrics', async () => {
		const file = Object.assign(new TFile(), { path: 'Notes/a.md' });
		const mc = Object.assign(new MetadataCache(), {
			getFileCache: () => ({
				links: [{ link: 'one' }, { link: 'two' }],
				embeds: [{ link: 'embed' }, { link: 'embed' }, { link: 'image.png' }],
				frontmatterLinks: [{ link: 'source' }],
			}),
			resolvedLinks: { 'Notes/a.md': { 'Notes/a.md': 1 } },
		});
		const vault = {
			getMarkdownFiles: () => [file],
			getAbstractFileByPath: () => file,
			cachedRead: jest.fn().mockResolvedValue('body'),
		};
		const plugin = makePlugin(undefined);
		await plugin.loadSettings();
		plugin.vaultMetrics = new FullVaultMetrics();
		plugin.vaultMetricsCollector = new FullVaultMetricsCollector(new Component())
			.setVault(vault as never).setMetadataCache(mc).setFullVaultMetrics(plugin.vaultMetrics);
		const store = new HistoryStore();
		const yesterday = new Date(2026, 10, 6);
		const today = new Date(2026, 10, 7);
		let previousDay: unknown;
		for (const [enabled, expected] of [[true, 6], [false, 3], [true, 6]] as const) {
			plugin.settings.countEmbeddedLinks = enabled;
			plugin.restartCollector();
			await jest.runAllTimersAsync();
			expect(plugin.vaultMetrics.notes).toBe(1);
			expect(plugin.vaultMetrics.links).toBe(expected);
			expect(plugin.vaultMetrics.quality).toBe(expected);
			expect(plugin.vaultMetricsCollector.aggregateByGroups([{ name: 'Notes', paths: ['Notes'] }])[0].links).toBe(expected);
			expect(plugin.vaultMetricsCollector.computeOrphanCount()).toBe(0);
			expect(plugin.vaultMetricsCollector.computeLinkValency()).toEqual({ incoming: new Map([['Notes/a.md', 1]]), outgoing: new Map([['Notes/a.md', 1]]) });
			if (!previousDay) {
				store.recordIfNeeded(yesterday, plugin.vaultMetrics);
				previousDay = store.all()[0];
			}
			store.recordIfNeeded(today, plugin.vaultMetrics);
			expect(store.all()[0]).toEqual(previousDay);
			expect(store.all()[1].links).toBe(expected);
		}
		expect(vault.cachedRead).toHaveBeenCalledTimes(3);
	});

	test('initial collector receives a saved false before the layout-ready scan', async () => {
		const plugin = makePlugin({ countEmbeddedLinks: false });
		const file = new TFile();
		const mc = Object.assign(new MetadataCache(), {
			getFileCache: () => ({ embeds: [{ link: 'image.png' }] }),
		});
		plugin.app = {
			vault: { cachedRead: async () => '' },
			metadataCache: mc,
			workspace: { onLayoutReady: jest.fn() },
		} as never;
		// Stop at the UI boundary; this test exercises the real initial collector setup.
		plugin.addStatusBarItem = () => { throw new Error('UI boundary'); };
		await expect(plugin.onload()).rejects.toThrow('UI boundary');
		expect((await plugin.vaultMetricsCollector.collect(file))?.metrics.links).toBe(0);
		expect(DEFAULT_SETTINGS.countEmbeddedLinks).toBe(true);
	});
});
