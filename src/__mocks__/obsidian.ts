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
  export class PluginSettingTab {
	app: any;
	plugin: any;
	constructor(app: any, plugin: any) { this.app = app; this.plugin = plugin; }
  }
  export class Setting {
	constructor(_containerEl: any) {}
	setName(_n: string) { return this; }
	setDesc(_d: string) { return this; }
	addToggle(_cb: any) { return this; }
	addTextArea(_cb: any) { return this; }
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