/**
 * The English catalogue is the source of truth: `Translations` is derived from
 * it, so every other locale is checked against this shape at compile time.
 *
 * Deliberately **not** `as const`. With `as const` every value would get a
 * literal type — `notes: 'notes'` rather than `notes: string` — and `ru.ts`
 * would fail to compile on its first translated line with
 * `TS2322: Type '"заметок"' is not assignable to type '"notes"'`. A plain
 * object literal still gives us everything we need: a missing key is a compile
 * error, an extra key is an excess-property error, and function signatures are
 * checked as usual. Literal types are not wanted here — the stable identifiers
 * that end up in CSS classes and settings keys live in `ToggleItem.id`, never
 * in a locale catalogue.
 *
 * Sections are filled in as call sites are converted; the skeleton is here so
 * that the shape of the catalogue is visible from the start.
 */
export const en = {
	/**
	 * Command names and the ribbon tooltip. Obsidian caches both when they are
	 * registered, so a language switch only reaches them after the plugin
	 * reloads — the settings screen says so.
	 */
	commands: {
		openStatistics: "Open vault statistics",
		exportHistory: "Export statistics history to CSV",
		openTangles: "Open vault tangles",
		createTanglesReport: "Create tangles report note",
		ribbonTooltip: "Open vault statistics",
	},

	/**
	 * Status bar labels. Keys match the statistic ids, which stay English
	 * because they double as CSS classes.
	 */
	statusBar: {
		notes: "notes",
		words: "words",
		links: "links",
		tags: "tags",
		QoV: "QoV",
		own: "own",
		source: "source",
		ownPct: "own",
		sourcePct: "source",
		concepts: "concepts",
		orphans: "orphans",
		tracePct: "traced",
	},
	settings: {
		/**
		 * Inline counts on page entries. These are three separate functions
		 * rather than one `count(n, noun)` helper on purpose: Russian needs
		 * three plural forms *and* agreement in gender, so a shared helper
		 * taking a noun cannot work — «нет папок» / «1 папка» but «нет групп» /
		 * «1 группа».
		 */
		folderCount: (n: number) => n === 0 ? "No folders" : `${n} folder${n === 1 ? "" : "s"}`,
		groupCount: (n: number) => n === 0 ? "No groups" : `${n} group${n === 1 ? "" : "s"}`,
		canonicalTagCount: (n: number) =>
			n === 0 ? "No canonical tags" : `${n} canonical tag${n === 1 ? "" : "s"}`,

		// Shared bits of page furniture.
		on: "On",
		off: "Off",
		ofTotal: (enabled: number, total: number) => `${enabled} of ${total}`,
		vaultRoot: "(vault root)",
		listEmpty: (addLabel: string) => `Nothing yet — use “${addLabel}”.`,
		pickNote: (name: string) => `Pick a note — ${name}`,
		pickFolder: (name: string) => `Pick a folder — ${name}`,
		countInvalid: "Must be a whole number of 0 or more.",
		addTag: "Add tag",
		addFolder: "Add folder",

		language: {
			name: "Language",
			desc: "Language of the plugin's interface. Auto follows Obsidian.",
			english: "English",
			russian: "Русский",
			auto: "Auto (follow Obsidian)",
		},

		individualItems: {
			name: "Show individual items",
			desc: "Whether to show multiple items at once or cycle them with a click",
		},

		statusBar: {
			name: "Status bar items",
			desc: "Which statistics the status bar shows. Cycling mode skips the ones turned off here.",
			notes: "Show notes",
			words: "Show words",
			wordsDesc: "Total word count across the vault.",
			links: "Show links",
			tags: "Show tags",
			quality: "Show quality",
			qualityAliases: ["QoV"],
			own: "Show own notes",
			ownDesc: "Notes tagged as your own thinking — see note classification.",
			source: "Show source notes",
			sourceDesc: "Notes about external material — see note classification.",
			ownPct: "Show own %",
			ownPctDesc: "Share of own notes within own+source classified set.",
			sourcePct: "Show source %",
			concepts: "Show concept notes",
			conceptsDesc: "Concepts are a grey zone — off by default.",
			orphans: "Show orphans",
			orphansDesc: "Notes with no incoming links — disconnected knowledge.",
			orphansAliases: ["disconnected"],
			tracePct: "Show trace %",
			tracePctDesc: "Share of source notes that at least one own note links to.",
		},

		counting: {
			heading: "What gets counted",
			excludedName: "Excluded folders",
			excludedDesc: "Folders to skip from statistics. Matched as a path prefix, so a folder covers everything under it.",
			excludedListDesc: "Folders to skip from statistics.",
			excludedAliases: ["ignore", "skip"],
			excludedPlaceholder: "e.g. Templates",

			classificationName: "Note classification",
			classificationDesc: "Tags that sort notes into your own thinking, external material, and concepts.",
			classificationValue: (own: number, source: number) => `${own} own / ${source} source`,
			ownTags: "Own tags",
			ownTagsDesc: "Tags marking your own thinking. Leading # is optional.",
			ownTagsAliases: ["classification", "zettelkasten"],
			ownTagsPlaceholder: "e.g. thought",
			sourceTags: "Source tags",
			sourceTagsDesc: "Tags marking notes about external material.",
			sourceTagsAliases: ["classification", "literature"],
			sourceTagsPlaceholder: "e.g. book",
			conceptTags: "Concept tags",
			conceptTagsDesc: "Tags marking concept notes (the grey zone).",
			conceptTagsAliases: ["classification"],
			conceptTagsPlaceholder: "e.g. concept",
		},

		sideViewHeading: "Side view",
		toolsHeading: "Tools",

		metrics: {
			name: "Metrics",
			desc: "Secondary metrics in the grid below the hero panel.",
			links: "Links",
			tags: "Tags",
			concepts: "Concepts",
			orphans: "Orphans",
			avgWords: "Avg words",
		},

		folderBreakdown: {
			name: "Folder breakdown",
			desc: "Per-folder section in the statistics view (PARA-style).",
			toggleAliases: ["PARA"],
			groupsName: "Folder groups (PARA)",
			groupsDesc: 'One row per group. Multiple paths in the same group are comma-separated, e.g. "Areas = 02. Сферы, 02b. Health".',
			groupsEmpty: "No groups yet — add one to get a per-group breakdown.",
			addGroup: "Add group",
			groupNamePlaceholder: "Projects",
			groupPathsPlaceholder: "01. Проекты, 02. Архив",
			groupNameAria: "Group name",
			groupPathsAria: "Group paths",
		},

		sourcesTrace: {
			name: "Sources with trace",
			desc: "How many source notes are referenced by at least one own note.",
			onTop5: "On + top 5",
			toggleName: "Show sources-with-trace",
			toggleDesc: "Section in the statistics view showing how many source notes are referenced by at least one own note (and which ones aren't).",
			danglingName: "Show dangling notes list",
			danglingDesc: "Inside Sources-with-trace: the top-5 list of source notes nothing links to. Off keeps just the bar and legend.",
			danglingAliases: ["dangling", "untraced"],
		},

		taxonomy: {
			name: "Taxonomy drift",
			desc: "Rare tags and tags outside your canonical set.",
			toggleName: "Show taxonomy drift",
			toggleDesc: "Section in the statistics view that lists rare tags and tags outside your canonical set.",
			thresholdName: "Rare tag threshold",
			thresholdDesc: "Tags used fewer than this many times are flagged as rare (likely typos or dead).",
			thresholdInvalid: "Must be a whole number of 1 or more.",
			canonicalName: "Canonical tags",
			canonicalDesc: "Your accepted tag set. Anything else is flagged as unknown. A canonical parent (e.g. 'journal') covers descendants ('journal/daily').",
			canonicalPlaceholder: "e.g. thought",
		},

		inbox: {
			name: "Inbox health",
			desc: "Notes in inbox folders and notes tagged for review, bucketed by age (<1d / 1–7d / 7–30d / 30+d).",
			toggleName: "Show inbox health",
			toggleDesc: "Section showing notes in inbox folders and notes outside them tagged with a review tag, bucketed by age (<1d / 1–7d / 7–30d / 30+d).",
			foldersName: "Inbox folders",
			foldersDesc: "Folders treated as inbox (techdebt of unprocessed input).",
			foldersPlaceholder: "e.g. 00. Входящие",
			tagsName: "Inbox review tags",
			tagsDesc: "Tags marking notes that need processing even when outside inbox folders. Leading # is optional.",
			tagsPlaceholder: "e.g. inbox/review",
		},

		history: {
			name: "History",
			desc: "30-day sparkline of how the vault evolves.",
			toggleName: "Show history",
			toggleDesc: "30-day sparkline section in the statistics view. Snapshots are recorded daily regardless of this toggle.",
			toggleAliases: ["sparkline"],
			exportName: "History export folder",
			exportDesc: "Last folder used for CSV export. The export command opens a folder picker each time and updates this value.",
			exportAliases: ["CSV"],
		},

		tangles: {
			name: "Tangles",
			desc: "Over-connected notes: hubs that link to and are linked from a lot of the vault.",
			valueSum: (total: number) => `SUM ≥ ${total}`,
			valueAndOr: (mode: string, minIn: number, minOut: number) => `${mode} ≥ ${minIn}/${minOut}`,
			modeName: "Selection mode",
			modeDesc: "AND: both thresholds must be met. OR: either threshold is enough. SUM: in + out must be ≥ total threshold.",
			modeAnd: "AND (both ≥ thresholds)",
			modeOr: "OR (either ≥ threshold)",
			modeSum: "SUM (in + out ≥ total)",
			minInName: "Min incoming links",
			minInDesc: "Minimum number of distinct notes that link to a tangle.",
			minOutName: "Min outgoing links",
			minOutDesc: "Minimum number of distinct notes a tangle links to.",
			minTotalName: "Min in + out",
			minTotalDesc: "Minimum value of (incoming + outgoing) for a note to count as a tangle.",
			topNName: "Top N",
			topNDesc: "How many tangles to show in the side view and report. 0 means no limit.",
			reportFolderName: "Tangles report folder",
			reportFolderDesc: "Folder in the vault where the tangles report note will be created. Empty = vault root.",
			excludeName: "Tangles exclude",
			excludeDesc: "Notes or folders to skip in tangle detection. Pick a note to exclude one file, or pick a folder to exclude everything under it. Folder match requires a trailing slash boundary — \"Daily\" does NOT match \"DailyArchive\".",
			excludePlaceholder: "e.g. Personal/Me.md",
			addNote: "Add note",
		},
	},
	view: {
		title: "Vault statistics",
		more: (n: number) => `+${n} more`,

		hero: {
			notes: "notes",
			words: "words",
			QoV: "QoV",
			wordsTooltip: (total: string) => `Total words across the vault: ${total}`,
			qovTooltip: "Quality of Vault — average number of links per note",
		},

		ratio: {
			title: "Own vs source",
			empty: "No notes classified yet — tag some notes (see settings).",
			own: "own",
			source: "source",
			concept: "concept",
		},

		metrics: {
			title: "Metrics",
			links: "links",
			tags: "tags",
			concepts: "concepts",
			orphans: "orphans",
			orphansTooltip: "Notes nothing else links to",
			avgWords: "avg words",
			avgWordsTooltip: (avg: string) => `Average words per note: ${avg} (words ÷ notes)`,
		},

		trace: {
			title: "Sources with trace",
			empty: "No source notes yet — tag notes about external material with a source tag.",
			traced: "traced",
			dangling: "dangling",
		},

		inbox: {
			title: "Inbox health",
			copy: "Copy inbox notes as markdown",
			notConfigured: "Configure inbox folders or review tags in settings to see this section.",
			folders: (n: number) => `${n} inbox folders`,
			tag: (tag: string) => `#${tag} (outside inbox)`,
			tags: (n: number) => `${n} review tags (outside inbox)`,
			nothingToCopy: "Nothing to copy — configure inbox folders or review tags first",
			copied: "Inbox copied to clipboard",
			copyFailed: "Failed to copy: clipboard unavailable",
			over30d: (n: number) => `${n} over 30d`,
			over30dTooltip: "Notes older than 30 days — actionable backlog",
			empty: "Empty.",
			ageFresh: "<1d",
			ageRecent: "1–7d",
			ageStale: "7–30d",
			ageOld: "30+d",
		},

		folders: {
			title: "Folder breakdown",
			ownSourceTooltip: (own: number, source: number) => `${own} own · ${source} source`,
		},

		taxonomy: {
			title: "Tag taxonomy",
			rare: (threshold: number) => `Rare (<${threshold})`,
			rareTooltip: "Tags used fewer than the configured threshold — likely typos or abandoned",
			rareEmpty: "Every tag passes the rare-tag threshold.",
			unknown: "Unknown",
			unknownTooltip: "Tags not present in your canonical set (configure it in settings)",
			unknownEmptyNoCanonical: "Configure canonical tags in settings to flag unknown tags.",
			unknownEmpty: "Every tag is in your canonical set.",
		},

		history: {
			title: "History",
			emptyNone: "First snapshot will appear once today's metrics settle.",
			emptyOne: "One day recorded so far. A trend will show after a second daily snapshot.",
			lastDays: (n: number) => `Last ${n} day${n === 1 ? "" : "s"}`,
			notes: "notes",
			own: "own",
			source: "source",
			links: "links",
			tags: "tags",
			orphans: "orphans",
			traced: "traced",
			delta: (delta: number) => `${delta > 0 ? "+" : ""}${delta} notes`,
			since: (date: string) => ` since ${date}`,
		},
	},

	tangles: {
		// Side view
		viewTitle: "Vault tangles",
		sectionTitle: "Tangles",
		count: (n: number) => `${n} ${n === 1 ? "tangle" : "tangles"}`,
		empty: "No notes match the current tangle thresholds. Lower min in / min out in settings, or remove an exclude entry.",
		legendIn: "incoming",
		legendOut: "outgoing",
		badgeTitle: (inCount: number, outCount: number) => `${inCount} incoming · ${outCount} outgoing`,
		exclude: "Exclude from tangles",
		modeSum: (total: number) => `sum · in+out ≥ ${total}`,
		modeAndOr: (mode: string, minIn: number, op: string, minOut: number) =>
			`${mode} · in ≥ ${minIn} ${op} out ≥ ${minOut}`,

		// Markdown report. The file name is localised because the note is
		// created afresh every time and collisions are handled by
		// `uniqueReportPath`; the CSV export name is not, see notices.
		reportFileName: (date: string) => `Vault Tangles — ${date}.md`,
		reportTitle: (date: string) => `# Vault Tangles — ${date}`,
		reportMode: (mode: string) => `- Mode: ${mode}`,
		reportTotal: (n: number) => `- Total tangles: ${n}`,
		reportEmpty: "_No notes match the current tangle thresholds._",
		reportTableHead: "| In | Out | Note |",
		reportModeSum: (total: number) => `\`sum\` · in+out ≥ ${total}`,
		reportModeAndOr: (mode: string, minIn: number, op: string, minOut: number) =>
			`\`${mode}\` · in ≥ ${minIn} ${op} out ≥ ${minOut}`,
	},

	inbox: {
		reportTitle: (date: string) => `## Inbox health — ${date}`,
		ageFresh: "fresh (<1d)",
		ageRecent: "recent (1–7d)",
		ageStale: "stale (7–30d)",
		ageOld: "old (30+d)",
		reportEmpty: "_Empty._",
	},

	pickers: {
		chooseFolder: "Choose a folder",
		vaultRoot: "/ (vault root)",
		findNote: "Type to find a note",
	},

	notices: {
		noHistory: "No history snapshots yet — try again after a few daily updates.",
		csvFileType: "CSV file",
		chooseCsvFolder: "Choose a folder for the CSV",
		exported: (n: number, target: string) =>
			`Exported ${n} snapshot${n === 1 ? "" : "s"} to ${target}`,
		exportFailed: (reason: string) => `Export failed: ${reason}`,
		excludedFromTangles: (path: string) => `Excluded "${path}" from tangles`,
		folderCreateFailed: (folder: string, reason: string) =>
			`Could not create folder "${folder}": ${reason}`,
		tanglesSaved: (n: number, path: string) =>
			`Saved ${n} tangle${n === 1 ? "" : "s"} to ${path}`,
		tanglesReportFailed: (reason: string) => `Tangles report failed: ${reason}`,
	},
};
