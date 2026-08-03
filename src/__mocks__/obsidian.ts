// src/__mocks__/obsidian.ts

export class Events {
	on() { return {}; }
	trigger() {}
  }
  export type EventRef = any;

  export class Vault {}
  export class TFile { path = ''; stat = { mtime: 0, size: 0 }; extension = 'md'; }
  export class TFolder {}
  export class MetadataCache {
	getFileCache() { return null; }
	getTags(): Record<string, number> { return {}; }
	on() { return {}; }
  }
  export class Component {
	registerEvent() {}
	registerInterval() {}
  }
  export class App {}

  /**
   * Enough of the 1.13 declarative settings surface to exercise the
   * definitions without a DOM. The tab under test calls update() after a
   * structural list change and refreshDomState() after a control change,
   * so both have to exist as no-ops.
   */
  export class SettingTab {
	app: any;
	containerEl: any = null;
	settingItems: any[] = [];
	getSettingDefinitions(): any[] { return []; }
	update() {}
	refreshDomState() {}
	getControlValue(_key: string): unknown { return undefined; }
	setControlValue(_key: string, _value: unknown): void {}
	display() {}
	hide() {}
  }
  export class PluginSettingTab extends SettingTab {
	plugin: any;
	constructor(app: any, plugin: any) { super(); this.app = app; this.plugin = plugin; }
  }
  export class Setting {
	settingEl: any = { addClass() {} };
	infoEl: any = { remove() {} };
	controlEl: any = null;
	constructor(_containerEl: any) {}
	setName(_n: string) { return this; }
	setDesc(_d: string) { return this; }
	addToggle(_cb: any) { return this; }
	addText(_cb: any) { return this; }
	addTextArea(_cb: any) { return this; }
	addExtraButton(_cb: any) { return this; }
  }
  export class ExtraButtonComponent {
	setIcon(_i: string) { return this; }
	setTooltip(_t: string) { return this; }
	onClick(_cb: any) { return this; }
  }
  export class Modal {
	app: any;
	constructor(app: any) { this.app = app; }
	open() {}
	close() {}
	setPlaceholder(_p: string) {}
  }
  export class SuggestModal extends Modal {}
  export class FuzzySuggestModal<T> extends SuggestModal {
	getItems(): T[] { return []; }
	getItemText(_item: T): string { return ''; }
	onChooseItem(_item: T): void {}
  }

  /**
   * Obsidian's interface language. Tests that care about locale resolution pass
   * a raw value to `setLocale` explicitly; everything else runs in English,
   * which `setupLocale.ts` enforces before each test.
   */
  export function getLanguage(): string { return 'en'; }
