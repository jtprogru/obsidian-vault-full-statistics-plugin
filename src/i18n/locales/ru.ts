import type { Translations } from '../types';
import { plural } from '../plural';

/**
 * Russian catalogue. Terminology follows Obsidian's own Russian locale where a
 * term exists there («хранилище», «заметка», «теги», «ссылки»); terms Obsidian
 * has no word for are decided in the plan and recorded here as they land.
 *
 * Plural forms go through `plural()` from `../plural`.
 */
export const ru: Translations = {
	commands: {},
	statusBar: {},
	settings: {
		folderCount: (n) => n === 0 ? "Нет папок" : `${n} ${plural(n, "папка", "папки", "папок")}`,
		groupCount: (n) => n === 0 ? "Нет групп" : `${n} ${plural(n, "группа", "группы", "групп")}`,
		canonicalTagCount: (n) => n === 0
			? "Нет канонических тегов"
			: `${n} ${plural(n, "канонический тег", "канонических тега", "канонических тегов")}`,
	},
	view: {},
	tangles: {},
	inbox: {},
	pickers: {},
	notices: {},
};
