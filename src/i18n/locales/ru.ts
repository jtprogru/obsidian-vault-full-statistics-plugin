import type { Translations } from '../types';
import { plural } from '../plural';

/**
 * Russian catalogue.
 *
 * Terminology follows Obsidian's own Russian locale where a term exists there:
 * «хранилище» for vault, «заметка» for note, «теги», «ссылки». Terms Obsidian
 * has no word for were decided once and are used consistently:
 *
 *   own notes    → свои заметки, «свои» in tight spots (not «собственные» —
 *                  too long for the status bar)
 *   source notes → источники (not «исходные заметки»)
 *   concept      → концепты
 *   orphans      → сироты (what the Obsidian community already says)
 *   tangles      → клубки («узлы» belongs to the graph)
 *   trace        → связь с источником; traced → «со ссылкой»
 *   dangling     → без ссылок
 *   inbox        → входящие
 *   QoV          → left as the abbreviation, tooltip translated
 *   sparkline    → спарклайн
 *
 * Status bar labels are kept as short as Russian allows: they sit in a narrow
 * strip and every one of them is wider than its English counterpart.
 *
 * Search aliases keep their English terms alongside the Russian ones — people
 * type «tags» or «PARA» into the settings search regardless of interface
 * language.
 */
export const ru: Translations = {
	commands: {
		openStatistics: "Открыть статистику хранилища",
		exportHistory: "Экспортировать историю в CSV",
		openTangles: "Открыть клубки хранилища",
		createTanglesReport: "Создать заметку с отчётом о клубках",
		ribbonTooltip: "Открыть статистику хранилища",
	},

	statusBar: {
		notes: "заметок",
		words: "слов",
		links: "ссылок",
		tags: "тегов",
		QoV: "QoV",
		own: "своих",
		source: "источников",
		ownPct: "своих",
		sourcePct: "источников",
		concepts: "концептов",
		orphans: "сирот",
		tracePct: "со ссылкой",
	},

	settings: {
		folderCount: (n) => n === 0 ? "Нет папок" : `${n} ${plural(n, "папка", "папки", "папок")}`,
		groupCount: (n) => n === 0 ? "Нет групп" : `${n} ${plural(n, "группа", "группы", "групп")}`,
		canonicalTagCount: (n) => n === 0
			? "Нет канонических тегов"
			: `${n} ${plural(n, "канонический тег", "канонических тега", "канонических тегов")}`,

		on: "Вкл.",
		off: "Выкл.",
		ofTotal: (enabled, total) => `${enabled} из ${total}`,
		vaultRoot: "(корень хранилища)",
		listEmpty: (addLabel) => `Пока пусто — нажмите «${addLabel}».`,
		pickNote: (name) => `Выберите заметку — ${name}`,
		pickFolder: (name) => `Выберите папку — ${name}`,
		countInvalid: "Целое число не меньше 0.",
		addTag: "Добавить тег",
		addFolder: "Добавить папку",

		language: {
			name: "Язык",
			desc: "Язык интерфейса плагина. «Автоматически» следует за языком Obsidian.",
			english: "English",
			russian: "Русский",
			auto: "Автоматически (как в Obsidian)",
		},

		heroLabels: {
			name: "Латинские подписи в шапке",
			desc: "Три верхние плитки сохраняют английские подписи и компактный формат числа. Пригодится на узкой панели, где перевод не помещается. Подсказки остаются на языке интерфейса.",
			aliases: ["hero", "latin", "шапка"],
		},

		individualItems: {
			name: "Показывать все элементы",
			desc: "Показывать статистики сразу все или перелистывать их по клику",
		},

		statusBar: {
			name: "Элементы строки состояния",
			desc: "Какие статистики показывает строка состояния. В режиме перелистывания выключенные пропускаются.",
			notes: "Заметки",
			words: "Слова",
			wordsDesc: "Суммарное число слов по всему хранилищу.",
			links: "Ссылки",
			tags: "Теги",
			quality: "Качество",
			qualityAliases: ["QoV", "качество"],
			own: "Свои заметки",
			ownDesc: "Заметки с тегами вашего собственного мышления — см. классификацию заметок.",
			source: "Источники",
			sourceDesc: "Заметки о внешнем материале — см. классификацию заметок.",
			ownPct: "Доля своих, %",
			ownPctDesc: "Доля своих заметок среди классифицированных (свои + источники).",
			sourcePct: "Доля источников, %",
			concepts: "Концепты",
			conceptsDesc: "Концепты — серая зона, по умолчанию выключены.",
			orphans: "Сироты",
			orphansDesc: "Заметки, на которые никто не ссылается — оторванное знание.",
			orphansAliases: ["disconnected", "сироты", "изолированные"],
			tracePct: "Доля со ссылкой, %",
			tracePctDesc: "Доля источников, на которые ссылается хотя бы одна своя заметка.",
		},

		counting: {
			heading: "Что попадает в подсчёт",
			excludedName: "Исключённые папки",
			excludedDesc: "Папки, которые не учитываются в статистике. Совпадение по префиксу пути, поэтому папка покрывает всё внутри себя.",
			excludedListDesc: "Папки, которые не учитываются в статистике.",
			excludedPlaceholder: "например, Templates",

			classificationName: "Классификация заметок",
			classificationDesc: "Теги и папки, по которым заметки делятся на своё мышление, внешний материал и концепты.",
			classificationValue: (own, source) => `${own} своих / ${source} источников`,
			ownTags: "Теги своих заметок",
			ownTagsDesc: "Теги, помечающие ваше собственное мышление. Ведущий # необязателен.",
			ownTagsPlaceholder: "например, thought",
			ownFolders: "Папки своих заметок",
			ownFoldersDesc: "Папки, заметки в которых считаются своим мышлением независимо от наличия соответствующего тега.",
			ownFoldersPlaceholder: "например, 01. Journal",
			sourceTags: "Теги источников",
			sourceTagsDesc: "Теги, помечающие заметки о внешнем материале.",
			sourceTagsPlaceholder: "например, book",
			sourceFolders: "Папки источников",
			sourceFoldersDesc: "Папки, заметки в которых считаются внешним материалом независимо от наличия тега источника.",
			sourceFoldersPlaceholder: "например, 02. Reading",
			conceptTags: "Теги концептов",
			conceptTagsDesc: "Теги, помечающие концепты (серая зона).",
			conceptTagsPlaceholder: "например, concept",
			conceptFolders: "Папки концептов",
			conceptFoldersDesc: "Папки, заметки в которых считаются концептами независимо от наличия тега концепта.",
			conceptFoldersPlaceholder: "например, 03. Concepts",
		},

		sideViewHeading: "Боковая панель",
		toolsHeading: "Инструменты",

		metrics: {
			name: "Метрики",
			desc: "Дополнительные метрики в сетке под верхней панелью.",
			links: "Ссылки",
			tags: "Теги",
			concepts: "Концепты",
			orphans: "Сироты",
			avgWords: "Слов в среднем",
		},

		folderBreakdown: {
			name: "Разбивка по папкам",
			desc: "Секция с разбивкой по папкам в панели статистики (в духе PARA).",
			toggleAliases: ["PARA", "папки"],
			groupsName: "Группы папок (PARA)",
			groupsDesc: "По строке на группу. Несколько путей в одной группе перечисляются через запятую, например «Areas = 02. Сферы, 02b. Health».",
			groupsEmpty: "Групп пока нет — добавьте одну, чтобы увидеть разбивку.",
			addGroup: "Добавить группу",
			groupNamePlaceholder: "Проекты",
			groupPathsPlaceholder: "01. Проекты, 02. Архив",
			groupNameAria: "Название группы",
			groupPathsAria: "Пути группы",
		},

		sourcesTrace: {
			name: "Источники со ссылками",
			desc: "Сколько источников упомянуто хотя бы в одной своей заметке.",
			onTop5: "Вкл. + топ-5",
			toggleName: "Показывать источники со ссылками",
			toggleDesc: "Секция в панели статистики: сколько источников упомянуто хотя бы в одной своей заметке (и какие не упомянуты).",
			danglingName: "Показывать список источников без ссылок",
			danglingDesc: "Внутри секции: топ-5 источников, на которые никто не ссылается. Выключено — остаются только полоса и легенда.",
			danglingAliases: ["dangling", "untraced", "без ссылок"],
		},

		taxonomy: {
			name: "Дрейф таксономии",
			desc: "Редкие теги и теги вне канонического набора.",
			toggleName: "Показывать дрейф таксономии",
			toggleDesc: "Секция в панели статистики со списком редких тегов и тегов вне вашего канонического набора.",
			thresholdName: "Порог редкого тега",
			thresholdDesc: "Теги, встречающиеся реже указанного числа раз, помечаются как редкие (скорее всего опечатки или заброшенные).",
			thresholdInvalid: "Целое число не меньше 1.",
			canonicalName: "Канонические теги",
			canonicalDesc: "Ваш принятый набор тегов. Всё остальное помечается как неизвестное. Канонический родитель (например, «journal») покрывает потомков («journal/daily»).",
			canonicalPlaceholder: "например, thought",
		},

		inbox: {
			name: "Состояние входящих",
			desc: "Заметки во входящих папках и заметки с тегом на разбор, разложенные по возрасту (<1д / 1–7д / 7–30д / 30+д).",
			toggleName: "Показывать состояние входящих",
			toggleDesc: "Секция с заметками во входящих папках и заметками вне их, помеченными тегом на разбор, по возрасту (<1д / 1–7д / 7–30д / 30+д).",
			foldersName: "Папки входящих",
			foldersDesc: "Папки, которые считаются входящими (техдолг неразобранного).",
			foldersPlaceholder: "например, 00. Входящие",
			tagsName: "Теги на разбор",
			tagsDesc: "Теги заметок, которые надо разобрать, даже если они лежат вне входящих папок. Ведущий # необязателен.",
			tagsPlaceholder: "например, inbox/review",
		},

		history: {
			name: "История",
			desc: "Спарклайн за 30 дней: как меняется хранилище.",
			toggleName: "Показывать историю",
			toggleDesc: "Секция со спарклайном за 30 дней. Снимки записываются ежедневно независимо от этого переключателя.",
			toggleAliases: ["sparkline", "спарклайн"],
			exportName: "Папка для экспорта истории",
			exportDesc: "Последняя папка, куда выгружался CSV. Команда экспорта каждый раз открывает выбор папки и обновляет это значение.",
			exportAliases: ["CSV"],
		},

		tangles: {
			name: "Клубки",
			desc: "Перегруженные связями заметки: узловые точки, которые ссылаются на многое и на которые ссылается многое.",
			valueSum: (total) => `SUM ≥ ${total}`,
			valueAndOr: (mode, minIn, minOut) => `${mode} ≥ ${minIn}/${minOut}`,
			modeName: "Режим отбора",
			modeDesc: "AND: нужны оба порога. OR: достаточно любого. SUM: сумма входящих и исходящих должна быть ≥ общего порога.",
			modeAnd: "AND (оба ≥ порогов)",
			modeOr: "OR (достаточно одного)",
			modeSum: "SUM (входящие + исходящие ≥ порога)",
			minInName: "Минимум входящих ссылок",
			minInDesc: "Минимальное число разных заметок, которые ссылаются на клубок.",
			minOutName: "Минимум исходящих ссылок",
			minOutDesc: "Минимальное число разных заметок, на которые ссылается клубок.",
			minTotalName: "Минимум входящих + исходящих",
			minTotalDesc: "Минимальная сумма входящих и исходящих ссылок, при которой заметка считается клубком.",
			topNName: "Топ N",
			topNDesc: "Сколько клубков показывать в панели и отчёте. 0 — без ограничения.",
			reportFolderName: "Папка для отчёта о клубках",
			reportFolderDesc: "Папка в хранилище, где будет создана заметка с отчётом. Пусто — корень хранилища.",
			excludeName: "Исключения из клубков",
			excludeDesc: "Заметки или папки, которые не участвуют в поиске клубков. Выберите заметку, чтобы исключить один файл, или папку, чтобы исключить всё внутри неё. Папка совпадает только по границе слеша — «Daily» НЕ покрывает «DailyArchive».",
			excludePlaceholder: "например, Personal/Me.md",
			addNote: "Добавить заметку",
		},
	},

	view: {
		title: "Статистика хранилища",
		more: (n) => `ещё ${n}`,

		hero: {
			notes: "заметок",
			words: "слов",
			QoV: "QoV",
			wordsTooltip: (total) => `Всего слов в хранилище: ${total}`,
			qovTooltip: "Quality of Vault — среднее число ссылок на заметку",
		},

		ratio: {
			title: "Свои и источники",
			empty: "Пока ничего не классифицировано — расставьте теги (см. настройки).",
			own: "своих",
			source: "источников",
			concept: "концептов",
		},

		metrics: {
			title: "Метрики",
			links: "ссылок",
			tags: "тегов",
			concepts: "концептов",
			orphans: "сирот",
			orphansTooltip: "Заметки, на которые никто не ссылается",
			avgWords: "слов в среднем",
			avgWordsTooltip: (avg) => `В среднем слов на заметку: ${avg} (слова ÷ заметки)`,
		},

		trace: {
			title: "Источники со ссылками",
			empty: "Источников пока нет — помечайте заметки о внешнем материале тегом источника.",
			traced: "со ссылкой",
			dangling: "без ссылок",
		},

		inbox: {
			title: "Состояние входящих",
			copy: "Скопировать входящие как markdown",
			notConfigured: "Укажите папки входящих или теги на разбор в настройках, чтобы увидеть эту секцию.",
			folders: (n) => `${n} ${plural(n, "папка входящих", "папки входящих", "папок входящих")}`,
			tag: (tag) => `#${tag} (вне входящих)`,
			tags: (n) => `${n} ${plural(n, "тег на разбор", "тега на разбор", "тегов на разбор")} (вне входящих)`,
			nothingToCopy: "Нечего копировать — сначала укажите папки входящих или теги на разбор",
			copied: "Входящие скопированы в буфер обмена",
			copyFailed: "Не удалось скопировать: буфер обмена недоступен",
			over30d: (n) => `${n} старше 30д`,
			over30dTooltip: "Заметки старше 30 дней — накопившийся долг",
			empty: "Пусто.",
			ageFresh: "<1д",
			ageRecent: "1–7д",
			ageStale: "7–30д",
			ageOld: "30+д",
		},

		folders: {
			title: "Разбивка по папкам",
			ownSourceTooltip: (own, source) => `${own} своих · ${source} источников`,
		},

		taxonomy: {
			title: "Таксономия тегов",
			rare: (threshold) => `Редкие (<${threshold})`,
			rareTooltip: "Теги, встречающиеся реже заданного порога — скорее всего опечатки или заброшенные",
			rareEmpty: "Все теги проходят порог редкости.",
			unknown: "Неизвестные",
			unknownTooltip: "Теги вне вашего канонического набора (настраивается в параметрах)",
			unknownEmptyNoCanonical: "Задайте канонические теги в настройках, чтобы отмечать неизвестные.",
			unknownEmpty: "Все теги входят в канонический набор.",
		},

		history: {
			title: "История",
			emptyNone: "Первый снимок появится, когда сегодняшние метрики устоятся.",
			emptyOne: "Записан один день. Тренд появится после второго ежедневного снимка.",
			lastDays: (n) => `Последние ${n} ${plural(n, "день", "дня", "дней")}`,
			notes: "заметки",
			own: "свои",
			source: "источники",
			links: "ссылки",
			tags: "теги",
			orphans: "сироты",
			traced: "со ссылкой",
			delta: (delta) =>
				`${delta > 0 ? "+" : ""}${delta} ${plural(Math.abs(delta), "заметка", "заметки", "заметок")}`,
			since: (date) => ` с ${date}`,
		},
	},

	tangles: {
		viewTitle: "Клубки хранилища",
		sectionTitle: "Клубки",
		count: (n) => `${n} ${plural(n, "клубок", "клубка", "клубков")}`,
		empty: "Ни одна заметка не проходит текущие пороги. Снизьте минимумы входящих и исходящих в настройках или уберите исключение.",
		legendIn: "входящие",
		legendOut: "исходящие",
		badgeTitle: (inCount, outCount) => `${inCount} входящих · ${outCount} исходящих`,
		exclude: "Исключить из клубков",
		modeSum: (total) => `sum · вх+исх ≥ ${total}`,
		modeAndOr: (mode, minIn, op, minOut) => `${mode} · вх ≥ ${minIn} ${op} исх ≥ ${minOut}`,

		reportFileName: (date) => `Клубки хранилища — ${date}.md`,
		reportTitle: (date) => `# Клубки хранилища — ${date}`,
		reportMode: (mode) => `- Режим: ${mode}`,
		reportTotal: (n) => `- Всего клубков: ${n}`,
		reportEmpty: "_Ни одна заметка не проходит текущие пороги клубков._",
		reportTableHead: "| Вх | Исх | Заметка |",
		reportModeSum: (total) => `\`sum\` · вх+исх ≥ ${total}`,
		reportModeAndOr: (mode, minIn, op, minOut) => `\`${mode}\` · вх ≥ ${minIn} ${op} исх ≥ ${minOut}`,
	},

	inbox: {
		reportTitle: (date) => `## Состояние входящих — ${date}`,
		ageFresh: "свежие (<1д)",
		ageRecent: "недавние (1–7д)",
		ageStale: "залежались (7–30д)",
		ageOld: "старые (30+д)",
		reportEmpty: "_Пусто._",
	},

	pickers: {
		chooseFolder: "Выберите папку",
		vaultRoot: "/ (корень хранилища)",
		findNote: "Начните вводить название заметки",
	},

	notices: {
		noHistory: "Снимков истории пока нет — попробуйте снова через несколько дней.",
		csvFileType: "Файл CSV",
		chooseCsvFolder: "Выберите папку для CSV",
		exported: (n, target) =>
			`Выгружено ${n} ${plural(n, "снимок", "снимка", "снимков")} в ${target}`,
		exportFailed: (reason) => `Не удалось выгрузить: ${reason}`,
		excludedFromTangles: (path) => `Заметка «${path}» исключена из клубков`,
		folderCreateFailed: (folder, reason) => `Не удалось создать папку «${folder}»: ${reason}`,
		tanglesSaved: (n, path) =>
			`Сохранено ${n} ${plural(n, "клубок", "клубка", "клубков")} в ${path}`,
		tanglesReportFailed: (reason) => `Не удалось построить отчёт о клубках: ${reason}`,
		languageChanged: "Язык изменён. Перезагрузите плагин, чтобы обновились названия команд и подсказка иконки.",
	},
};
