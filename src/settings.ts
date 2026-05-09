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
	showOrphans: boolean,
	showTracePct: boolean,
	showSourcesTrace: boolean,
	excludedFolders: string[],
	ownTags: string[],
	sourceTags: string[],
	conceptTags: string[],
	folderGroups: FolderGroup[],
	showFolderBreakdown: boolean,
	historyExportFolder: string,
	canonicalTags: string[],
	rareTagThreshold: number,
	showTaxonomyDrift: boolean,
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

			new Setting(containerEl)
				.setName("Show orphans")
				.setDesc("Notes with no incoming links — disconnected knowledge.")
				.addToggle((value) => {
					value
						.setValue(this.plugin.settings.showOrphans)
						.onChange(async (value) => {
							this.plugin.settings.showOrphans = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("Show trace %")
				.setDesc("Share of source notes that at least one own note links to.")
				.addToggle((value) => {
					value
						.setValue(this.plugin.settings.showTracePct)
						.onChange(async (value) => {
							this.plugin.settings.showTracePct = value;
							await this.plugin.saveSettings();
						});
				});
		}

		this.addEditableStringList(
			containerEl,
			"Excluded folders",
			"Folders to skip from statistics.",
			"e.g. Templates",
			() => this.plugin.settings.excludedFolders,
			(items) => { this.plugin.settings.excludedFolders = items; },
			() => this.plugin.restartCollector(),
		);

		this.addEditableStringList(
			containerEl,
			"Own tags",
			"Tags marking your own thinking. Leading # is optional.",
			"e.g. thought",
			() => this.plugin.settings.ownTags,
			(items) => { this.plugin.settings.ownTags = items; },
			() => this.plugin.restartCollector(),
		);

		this.addEditableStringList(
			containerEl,
			"Source tags",
			"Tags marking notes about external material.",
			"e.g. book",
			() => this.plugin.settings.sourceTags,
			(items) => { this.plugin.settings.sourceTags = items; },
			() => this.plugin.restartCollector(),
		);

		this.addEditableStringList(
			containerEl,
			"Concept tags",
			"Tags marking concept notes (the grey zone).",
			"e.g. concept",
			() => this.plugin.settings.conceptTags,
			(items) => { this.plugin.settings.conceptTags = items; },
			() => this.plugin.restartCollector(),
		);

		new Setting(containerEl)
			.setName("Show folder breakdown")
			.setDesc("Per-folder section in the statistics view (PARA-style).")
			.addToggle((value) => {
				value
					.setValue(this.plugin.settings.showFolderBreakdown)
					.onChange(async (v) => {
						this.plugin.settings.showFolderBreakdown = v;
						await this.plugin.saveSettings();
					});
			});

		this.addFolderGroupsEditor(containerEl);

		new Setting(containerEl)
			.setName("Show sources-with-trace")
			.setDesc("Section in the statistics view showing how many source notes are referenced by at least one own note (and which ones aren't).")
			.addToggle((value) => {
				value
					.setValue(this.plugin.settings.showSourcesTrace)
					.onChange(async (v) => {
						this.plugin.settings.showSourcesTrace = v;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Show taxonomy drift")
			.setDesc("Section in the statistics view that lists rare tags and tags outside your canonical set.")
			.addToggle((value) => {
				value
					.setValue(this.plugin.settings.showTaxonomyDrift)
					.onChange(async (v) => {
						this.plugin.settings.showTaxonomyDrift = v;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Rare tag threshold")
			.setDesc("Tags used fewer than this many times are flagged as rare (likely typos or dead).")
			.addText((text) => {
				text.setPlaceholder("3")
					.setValue(String(this.plugin.settings.rareTagThreshold))
					.onChange(async (v) => {
						const n = parseInt(v.trim(), 10);
						this.plugin.settings.rareTagThreshold = Number.isFinite(n) && n > 0 ? n : 3;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "number";
				text.inputEl.min = "1";
				text.inputEl.style.width = "5em";
			});

		this.addEditableStringList(
			containerEl,
			"Canonical tags",
			"Your accepted tag set. Anything else is flagged as unknown. A canonical parent (e.g. 'journal') covers descendants ('journal/daily').",
			"e.g. thought",
			() => this.plugin.settings.canonicalTags,
			(items) => { this.plugin.settings.canonicalTags = items; },
		);

		new Setting(containerEl)
			.setName("History export folder")
			.setDesc("Last folder used for CSV export. The export command opens a folder picker each time and updates this value.")
			.addText((text) => {
				text.setPlaceholder("(vault root)")
					.setValue(this.plugin.settings.historyExportFolder)
					.onChange(async (v) => {
						this.plugin.settings.historyExportFolder = v.trim().replace(/\/+$/, "");
						await this.plugin.saveSettings();
					});
				text.inputEl.style.width = "100%";
			});
	}

	/**
	 * Renders an editable list of strings: one row per item with a text
	 * input and a trash icon, plus a "+ Add" button at the bottom. Saves
	 * on every change. Empty items are kept while editing so the user can
	 * type a fresh entry; they are filtered on `set` only when committed.
	 */
	private addEditableStringList(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		placeholder: string,
		get: () => string[],
		set: (items: string[]) => void,
		onChange?: () => void,
	) {
		new Setting(containerEl).setName(name).setDesc(desc).setHeading();

		const listEl = containerEl.createDiv({ cls: "vfs-settings-list" });

		const render = () => {
			listEl.empty();
			const items = get();

			items.forEach((value, idx) => {
				const row = new Setting(listEl);
				row.addText((text) => {
					text.setValue(value).setPlaceholder(placeholder)
						.onChange(async (newVal) => {
							const arr = [...get()];
							arr[idx] = newVal.trim();
							set(arr);
							await this.plugin.saveSettings();
							if (onChange) onChange();
						});
					text.inputEl.style.width = "100%";
				});
				row.addExtraButton((btn) => {
					btn.setIcon("trash").setTooltip("Remove").onClick(async () => {
						const arr = [...get()];
						arr.splice(idx, 1);
						set(arr);
						await this.plugin.saveSettings();
						render();
						if (onChange) onChange();
					});
				});
			});

			new Setting(listEl).addButton((btn) => {
				btn.setButtonText("+ Add").setCta().onClick(async () => {
					set([...get(), ""]);
					await this.plugin.saveSettings();
					render();
				});
			});
		};
		render();
	}

	/**
	 * Folder groups have nested structure (name + list of paths) so each
	 * group is rendered as a small card: editable name with a delete
	 * button on the header row, then per-path rows with their own delete
	 * buttons, plus "+ Add path" inside the card and "+ Add group" at the
	 * bottom of the section.
	 */
	private addFolderGroupsEditor(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName("Folder groups (PARA)")
			.setDesc("Each group is shown as a row in the folder breakdown section.")
			.setHeading();

		const wrap = containerEl.createDiv({ cls: "vfs-settings-fg" });

		const render = () => {
			wrap.empty();
			const groups = this.plugin.settings.folderGroups;

			groups.forEach((group, gi) => {
				const card = wrap.createDiv({ cls: "vfs-settings-fg-card" });

				new Setting(card)
					.setClass("vfs-settings-fg-head")
					.addText((text) => {
						text.setValue(group.name).setPlaceholder("Group name (e.g. Projects)")
							.onChange(async (v) => {
								this.plugin.settings.folderGroups[gi].name = v.trim();
								await this.plugin.saveSettings();
							});
						text.inputEl.style.width = "100%";
					})
					.addExtraButton((btn) => {
						btn.setIcon("trash").setTooltip("Remove group").onClick(async () => {
							this.plugin.settings.folderGroups.splice(gi, 1);
							await this.plugin.saveSettings();
							render();
						});
					});

				const pathsEl = card.createDiv({ cls: "vfs-settings-fg-paths" });
				group.paths.forEach((path, pi) => {
					new Setting(pathsEl)
						.addText((text) => {
							text.setValue(path).setPlaceholder("e.g. 01. Проекты")
								.onChange(async (v) => {
									this.plugin.settings.folderGroups[gi].paths[pi] = v.trim().replace(/\/+$/, "");
									await this.plugin.saveSettings();
								});
							text.inputEl.style.width = "100%";
						})
						.addExtraButton((btn) => {
							btn.setIcon("trash").setTooltip("Remove path").onClick(async () => {
								this.plugin.settings.folderGroups[gi].paths.splice(pi, 1);
								await this.plugin.saveSettings();
								render();
							});
						});
				});

				new Setting(pathsEl).addButton((btn) => {
					btn.setButtonText("+ Add path").onClick(async () => {
						this.plugin.settings.folderGroups[gi].paths.push("");
						await this.plugin.saveSettings();
						render();
					});
				});
			});

			new Setting(wrap).addButton((btn) => {
				btn.setButtonText("+ Add group").setCta().onClick(async () => {
					this.plugin.settings.folderGroups.push({ name: "", paths: [""] });
					await this.plugin.saveSettings();
					render();
				});
			});
		};
		render();
	}
}
