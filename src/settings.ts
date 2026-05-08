import { App, PluginSettingTab, Setting } from "obsidian";

import StatisticsPlugin from "./main";

export interface FullStatisticsPluginSettings {
	displayIndividualItems: boolean,
	showNotes: boolean,
	showLinks: boolean,
	showTags: boolean,
	showQuality: boolean,
	excludedFolders: string[],
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
	}
}
