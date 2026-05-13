import { App, PluginSettingTab, Setting, setIcon } from "obsidian";

import StatisticsPlugin from "./main";
import { FolderPickerModal, NoteFuzzyPickerModal } from "./pickers";

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
	showDanglingList: boolean,
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
	showHistory: boolean,
	showInbox: boolean,
	inboxFolders: string[],
	inboxReviewTags: string[],
	metricsShowLinks: boolean,
	metricsShowTags: boolean,
	metricsShowConcepts: boolean,
	metricsShowOrphans: boolean,
	metricsShowAvgWords: boolean,
	tanglesMode: 'and' | 'or' | 'sum',
	tanglesMinIn: number,
	tanglesMinOut: number,
	tanglesMinTotal: number,
	tanglesTopN: number,
	tanglesReportFolder: string,
	tanglesExclude: string[],
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

		new Setting(containerEl).setName("Metrics section").setHeading();

		const metricsToggles: Array<[string, keyof FullStatisticsPluginSettings]> = [
			["Links", "metricsShowLinks"],
			["Tags", "metricsShowTags"],
			["Concepts", "metricsShowConcepts"],
			["Orphans", "metricsShowOrphans"],
			["Avg words", "metricsShowAvgWords"],
		];
		for (const [name, key] of metricsToggles) {
			new Setting(containerEl).setName(name).addToggle((t) => {
				t.setValue(this.plugin.settings[key] as boolean)
					.onChange(async (v) => {
						(this.plugin.settings[key] as boolean) = v;
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
			.setName("Show dangling notes list")
			.setDesc("Inside Sources-with-trace: the top-5 list of source notes nothing links to. Off keeps just the bar and legend.")
			.addToggle((value) => {
				value
					.setValue(this.plugin.settings.showDanglingList)
					.onChange(async (v) => {
						this.plugin.settings.showDanglingList = v;
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
				text.inputEl.classList.add("vfs-input-narrow");
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
			.setName("Show inbox health")
			.setDesc("Section showing notes in inbox folders and notes outside them tagged with a review tag, bucketed by age (<1d / 1–7d / 7–30d / 30+d).")
			.addToggle((value) => {
				value
					.setValue(this.plugin.settings.showInbox)
					.onChange(async (v) => {
						this.plugin.settings.showInbox = v;
						await this.plugin.saveSettings();
					});
			});

		this.addEditableStringList(
			containerEl,
			"Inbox folders",
			"Folders treated as inbox (techdebt of unprocessed input).",
			"e.g. 00. Входящие",
			() => this.plugin.settings.inboxFolders,
			(items) => { this.plugin.settings.inboxFolders = items; },
			() => this.plugin.restartCollector(),
		);

		this.addEditableStringList(
			containerEl,
			"Inbox review tags",
			"Tags marking notes that need processing even when outside inbox folders. Leading # is optional.",
			"e.g. inbox/review",
			() => this.plugin.settings.inboxReviewTags,
			(items) => { this.plugin.settings.inboxReviewTags = items; },
			() => this.plugin.restartCollector(),
		);

		new Setting(containerEl)
			.setName("Show history")
			.setDesc("30-day sparkline section in the statistics view. Snapshots are recorded daily regardless of this toggle.")
			.addToggle((value) => {
				value
					.setValue(this.plugin.settings.showHistory)
					.onChange(async (v) => {
						this.plugin.settings.showHistory = v;
						await this.plugin.saveSettings();
					});
			});

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
				text.inputEl.classList.add("vfs-input-wide");
			});

		this.addTanglesSection(containerEl);
	}

	private addTanglesSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Tangles").setHeading();

		new Setting(containerEl)
			.setName("Selection mode")
			.setDesc("AND: both thresholds must be met. OR: either threshold is enough. SUM: in + out must be ≥ total threshold.")
			.addDropdown((dd) => {
				dd.addOption("and", "AND (both ≥ thresholds)")
					.addOption("or", "OR (either ≥ threshold)")
					.addOption("sum", "SUM (in + out ≥ total)")
					.setValue(this.plugin.settings.tanglesMode)
					.onChange(async (v) => {
						this.plugin.settings.tanglesMode = (v as 'and' | 'or' | 'sum');
						this.display();
						await this.plugin.saveSettings();
					});
			});

		const mode = this.plugin.settings.tanglesMode;
		if (mode === 'and' || mode === 'or') {
			new Setting(containerEl)
				.setName("Min incoming links")
				.setDesc("Minimum number of distinct notes that link to a tangle.")
				.addText((text) => {
					text.setPlaceholder("5")
						.setValue(String(this.plugin.settings.tanglesMinIn))
						.onChange(async (v) => {
							const n = parseInt(v.trim(), 10);
							this.plugin.settings.tanglesMinIn = Number.isFinite(n) && n >= 0 ? n : 5;
							await this.plugin.saveSettings();
						});
					text.inputEl.type = "number";
					text.inputEl.min = "0";
					text.inputEl.classList.add("vfs-input-narrow");
				});

			new Setting(containerEl)
				.setName("Min outgoing links")
				.setDesc("Minimum number of distinct notes a tangle links to.")
				.addText((text) => {
					text.setPlaceholder("5")
						.setValue(String(this.plugin.settings.tanglesMinOut))
						.onChange(async (v) => {
							const n = parseInt(v.trim(), 10);
							this.plugin.settings.tanglesMinOut = Number.isFinite(n) && n >= 0 ? n : 5;
							await this.plugin.saveSettings();
						});
					text.inputEl.type = "number";
					text.inputEl.min = "0";
					text.inputEl.classList.add("vfs-input-narrow");
				});
		}

		if (mode === 'sum') {
			new Setting(containerEl)
				.setName("Min in + out")
				.setDesc("Minimum value of (incoming + outgoing) for a note to count as a tangle.")
				.addText((text) => {
					text.setPlaceholder("10")
						.setValue(String(this.plugin.settings.tanglesMinTotal))
						.onChange(async (v) => {
							const n = parseInt(v.trim(), 10);
							this.plugin.settings.tanglesMinTotal = Number.isFinite(n) && n >= 0 ? n : 10;
							await this.plugin.saveSettings();
						});
					text.inputEl.type = "number";
					text.inputEl.min = "0";
					text.inputEl.classList.add("vfs-input-narrow");
				});
		}

		new Setting(containerEl)
			.setName("Top N")
			.setDesc("How many tangles to show in the side view and report. 0 means no limit.")
			.addText((text) => {
				text.setPlaceholder("25")
					.setValue(String(this.plugin.settings.tanglesTopN))
					.onChange(async (v) => {
						const n = parseInt(v.trim(), 10);
						this.plugin.settings.tanglesTopN = Number.isFinite(n) && n >= 0 ? n : 25;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "number";
				text.inputEl.min = "0";
				text.inputEl.classList.add("vfs-input-narrow");
			});

		new Setting(containerEl)
			.setName("Tangles report folder")
			.setDesc("Folder in the vault where the tangles report note will be created. Empty = vault root.")
			.addText((text) => {
				text.setPlaceholder("(vault root)")
					.setValue(this.plugin.settings.tanglesReportFolder)
					.onChange(async (v) => {
						this.plugin.settings.tanglesReportFolder = v.trim().replace(/\/+$/, "");
						await this.plugin.saveSettings();
					});
				text.inputEl.classList.add("vfs-input-wide");
			});

		this.addTanglesExcludeList(containerEl);
	}

	/**
	 * Editable list for tangle exclusions. Each existing entry stays
	 * inline-editable (typos, manual folder prefixes) but new entries
	 * come from fuzzy pickers — note picker for files, folder picker for
	 * directory prefixes — so the user does not have to remember where a
	 * note lives in the vault tree before excluding it.
	 */
	private addTanglesExcludeList(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName("Tangles exclude")
			.setDesc("Notes or folders to skip in tangle detection. Pick a note to exclude one file, or pick a folder to exclude everything under it. Folder match requires a trailing slash boundary — \"Daily\" does NOT match \"DailyArchive\".")
			.setHeading();

		const listEl = containerEl.createDiv({ cls: "vfs-settings-list" });

		const addEntry = async (value: string) => {
			const trimmed = value.trim().replace(/\/+$/, "");
			if (!trimmed) return;
			if (this.plugin.settings.tanglesExclude.includes(trimmed)) return;
			this.plugin.settings.tanglesExclude = [...this.plugin.settings.tanglesExclude, trimmed];
			await this.plugin.saveSettings();
			render();
		};

		const render = () => {
			listEl.empty();
			const items = this.plugin.settings.tanglesExclude;

			items.forEach((value, idx) => {
				const row = new Setting(listEl);
				row.addText((text) => {
					text.setValue(value).setPlaceholder("e.g. Personal/Me.md")
						.onChange(async (newVal) => {
							const arr = [...this.plugin.settings.tanglesExclude];
							arr[idx] = newVal.trim();
							this.plugin.settings.tanglesExclude = arr;
							await this.plugin.saveSettings();
						});
					text.inputEl.classList.add("vfs-input-wide");
				});
				row.addExtraButton((btn) => {
					btn.setIcon("trash").setTooltip("Remove").onClick(async () => {
						const arr = [...this.plugin.settings.tanglesExclude];
						arr.splice(idx, 1);
						this.plugin.settings.tanglesExclude = arr;
						await this.plugin.saveSettings();
						render();
					});
				});
			});

			new Setting(listEl)
				.addButton((btn) => {
					btn.setButtonText("+ Add note...").setCta().onClick(() => {
						new NoteFuzzyPickerModal(this.app, (file) => {
							addEntry(file.path);
						}, 'Pick a note to exclude from tangles').open();
					});
				})
				.addButton((btn) => {
					btn.setButtonText("+ Add folder...").onClick(() => {
						new FolderPickerModal(this.app, (folder) => {
							const path = folder.path === '' || folder.path === '/' ? '' : folder.path;
							if (!path) {
								// Excluding the vault root would hide every
								// tangle — almost always a mis-click. Surface
								// the no-op rather than silently consuming it.
								new Setting(listEl); // re-render shows nothing changed
								return;
							}
							addEntry(path);
						}, 'Pick a folder to exclude (everything below it is skipped)').open();
					});
				});
		};
		render();
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
					text.inputEl.classList.add("vfs-input-wide");
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
	 * One row per group: [name] = [comma-separated paths] [×]. Multiple
	 * paths inside a group are entered as a comma list in the second
	 * input — same shape parseFolderGroups already supports. Internal
	 * model stays {name, paths: string[]}; the UI only flattens the
	 * paths array on display and splits it on edit.
	 */
	private addFolderGroupsEditor(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName("Folder groups (PARA)")
			.setDesc('One row per group. Multiple paths in the same group are comma-separated, e.g. "Areas = 02. Сферы, 02b. Health".')
			.setHeading();

		const wrap = containerEl.createDiv({ cls: "vfs-settings-fg" });

		const render = () => {
			wrap.empty();
			const groups = this.plugin.settings.folderGroups;

			groups.forEach((group, gi) => {
				this.renderGroupRow(wrap, group, gi, render);
			});

			new Setting(wrap).addButton((btn) => {
				btn.setButtonText("+ Add group").setCta().onClick(async () => {
					this.plugin.settings.folderGroups.push({ name: "", paths: [] });
					await this.plugin.saveSettings();
					render();
				});
			});
		};
		render();
	}

	private renderGroupRow(wrap: HTMLElement, group: FolderGroup, gi: number, rerender: () => void) {
		const row = wrap.createDiv({ cls: "vfs-settings-fg-row" });

		const nameInput = row.createEl("input", {
			cls: "vfs-settings-fg-name",
			type: "text",
			attr: { placeholder: "Projects" },
		});
		nameInput.value = group.name;
		nameInput.addEventListener("change", async () => {
			this.plugin.settings.folderGroups[gi].name = nameInput.value.trim();
			await this.plugin.saveSettings();
		});

		row.createSpan({ cls: "vfs-settings-fg-eq", text: "=" });

		const pathsInput = row.createEl("input", {
			cls: "vfs-settings-fg-path-input",
			type: "text",
			attr: { placeholder: "01. Проекты, 02. Архив" },
		});
		pathsInput.value = group.paths.join(", ");
		pathsInput.addEventListener("change", async () => {
			this.plugin.settings.folderGroups[gi].paths = pathsInput.value
				.split(",")
				.map(p => p.trim().replace(/\/+$/, ""))
				.filter(p => p.length > 0);
			await this.plugin.saveSettings();
		});

		const del = row.createEl("button", {
			cls: "clickable-icon vfs-settings-fg-icon",
			attr: { "aria-label": "Remove group" },
		});
		setIcon(del, "x");
		del.addEventListener("click", async () => {
			this.plugin.settings.folderGroups.splice(gi, 1);
			await this.plugin.saveSettings();
			rerender();
		});
	}
}
