import { App, PluginSettingTab, Setting } from "obsidian";

import StatisticsPlugin from "./main";

export interface FolderGroup {
	name: string;
	paths: string[];
}

export interface FullStatisticsPluginSettings {
	displayIndividualItems: boolean,
	showNotes: boolean,
	showLinks: boolean,
	showTags: boolean,
	showQuality: boolean,
	showOwn: boolean,
	showSource: boolean,
	showOwnPct: boolean,
	showSourcePct: boolean,
	showConcepts: boolean,
	excludedFolders: string[],
	ownTags: string[],
	sourceTags: string[],
	conceptTags: string[],
	folderGroups: FolderGroup[],
}

export function parseFolderGroups(text: string): FolderGroup[] {
	const groups: FolderGroup[] = [];
	for (const rawLine of text.split("\n")) {
		const line = rawLine.trim();
		if (line.length === 0 || line.startsWith("#")) continue;
		const eqIdx = line.indexOf("=");
		if (eqIdx === -1) continue;
		const name = line.slice(0, eqIdx).trim();
		const paths = line.slice(eqIdx + 1)
			.split(",")
			.map(p => p.trim().replace(/\/+$/, ""))
			.filter(p => p.length > 0);
		if (name.length === 0 || paths.length === 0) continue;
		groups.push({ name, paths });
	}
	return groups;
}

export function serializeFolderGroups(groups: FolderGroup[]): string {
	return groups.map(g => `${g.name} = ${g.paths.join(", ")}`).join("\n");
}

export class FullStatisticsPluginSettingTab extends PluginSettingTab {
	plugin: StatisticsPlugin;

	constructor(app: App, plugin: StatisticsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Show individual items")
			.setDesc("Whether to show multiple items at once or cycle them with a click")
			.addToggle((value) => {
				value
					.setValue(this.plugin.settings.displayIndividualItems)
					.onChange(async (value) => {
						this.plugin.settings.displayIndividualItems = value;
						this.display();
						await this.plugin.saveSettings();
					});
			});

		if (this.plugin.settings.displayIndividualItems) {
			new Setting(containerEl)
				.setName("Show notes")
				.addToggle((value) => {
					value
						.setValue(this.plugin.settings.showNotes)
						.onChange(async (value) => {
							this.plugin.settings.showNotes = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("Show links")
				.addToggle((value) => {
					value
						.setValue(this.plugin.settings.showLinks)
						.onChange(async (value) => {
							this.plugin.settings.showLinks = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("Show tags")
				.addToggle((value) => {
					value
						.setValue(this.plugin.settings.showTags)
						.onChange(async (value) => {
							this.plugin.settings.showTags = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("Show quality")
				.addToggle((value) => {
					value
						.setValue(this.plugin.settings.showQuality)
						.onChange(async (value) => {
							this.plugin.settings.showQuality = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("Show own notes")
				.setDesc("Notes tagged as your own thinking (own taxonomy below).")
				.addToggle((value) => {
					value
						.setValue(this.plugin.settings.showOwn)
						.onChange(async (value) => {
							this.plugin.settings.showOwn = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("Show source notes")
				.setDesc("Notes about external material (source taxonomy below).")
				.addToggle((value) => {
					value
						.setValue(this.plugin.settings.showSource)
						.onChange(async (value) => {
							this.plugin.settings.showSource = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("Show own %")
				.setDesc("Share of own notes within own+source classified set.")
				.addToggle((value) => {
					value
						.setValue(this.plugin.settings.showOwnPct)
						.onChange(async (value) => {
							this.plugin.settings.showOwnPct = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("Show source %")
				.addToggle((value) => {
					value
						.setValue(this.plugin.settings.showSourcePct)
						.onChange(async (value) => {
							this.plugin.settings.showSourcePct = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("Show concept notes")
				.setDesc("Concepts are a grey zone — off by default.")
				.addToggle((value) => {
					value
						.setValue(this.plugin.settings.showConcepts)
						.onChange(async (value) => {
							this.plugin.settings.showConcepts = value;
							await this.plugin.saveSettings();
						});
				});
		}

		new Setting(containerEl)
			.setName("Excluded folders")
			.setDesc("Folders to exclude from statistics. Enter one folder path per line. Example: Templates")
			.addTextArea((text) => {
				text
					.setPlaceholder("Templates\nArchive\nDaily Notes")
					.setValue(this.plugin.settings.excludedFolders.join("\n"))
					.onChange(async (value) => {
						const folders = value
							.split("\n")
							.map(f => f.trim())
							.filter(f => f.length > 0);
						this.plugin.settings.excludedFolders = folders;
						await this.plugin.saveSettings();
						this.plugin.restartCollector();
					});
				text.inputEl.rows = 6;
				text.inputEl.style.width = "100%";
				text.inputEl.style.fontFamily = "monospace";
			});

		this.addTagListSetting(
			containerEl,
			"Own tags",
			"Tags marking your own thinking. One per line. Leading # is optional.",
			"thought\nsynthesis\nfleeting",
			() => this.plugin.settings.ownTags,
			(tags) => { this.plugin.settings.ownTags = tags; },
		);

		this.addTagListSetting(
			containerEl,
			"Source tags",
			"Tags marking notes about external material. One per line.",
			"book\narticle\nvideo\nlecture\nliterature\nliterature-note",
			() => this.plugin.settings.sourceTags,
			(tags) => { this.plugin.settings.sourceTags = tags; },
		);

		this.addTagListSetting(
			containerEl,
			"Concept tags",
			"Tags marking concept notes (the grey zone). One per line.",
			"concept",
			() => this.plugin.settings.conceptTags,
			(tags) => { this.plugin.settings.conceptTags = tags; },
		);

		new Setting(containerEl)
			.setName("Folder groups (PARA)")
			.setDesc("Group folders for per-section breakdown in the statistics view. " +
				"One group per line as `Name = path1, path2`. Leave empty to hide the section.")
			.addTextArea((text) => {
				text
					.setPlaceholder("Projects = 01. Проекты\nAreas = 02. Сферы\nResources = 03. Ресурсы\nArchive = 04. Архив\nInbox = 00. Входящие")
					.setValue(serializeFolderGroups(this.plugin.settings.folderGroups))
					.onChange(async (value) => {
						this.plugin.settings.folderGroups = parseFolderGroups(value);
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 8;
				text.inputEl.style.width = "100%";
				text.inputEl.style.fontFamily = "monospace";
			});
	}

	private addTagListSetting(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		placeholder: string,
		get: () => string[],
		set: (tags: string[]) => void,
	) {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addTextArea((text) => {
				text
					.setPlaceholder(placeholder)
					.setValue(get().join("\n"))
					.onChange(async (value) => {
						const tags = value
							.split("\n")
							.map(t => t.trim())
							.filter(t => t.length > 0);
						set(tags);
						await this.plugin.saveSettings();
						this.plugin.restartCollector();
					});
				text.inputEl.rows = 6;
				text.inputEl.style.width = "100%";
				text.inputEl.style.fontFamily = "monospace";
			});
	}
}
