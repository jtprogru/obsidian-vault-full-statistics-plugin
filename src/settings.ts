import { App, PluginSettingTab, Setting } from "obsidian";

import StatisticsPlugin from "./main";

export interface FullStatisticsPluginSettings {
	displayIndividualItems: boolean,
	showNotes: boolean,
	showLinks: boolean,
	showQuality: boolean,
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

		if (!this.plugin.settings.displayIndividualItems) {
			return;
		}

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
}
