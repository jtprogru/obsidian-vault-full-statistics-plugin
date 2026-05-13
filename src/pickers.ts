import { App, FuzzySuggestModal, TFile, TFolder } from 'obsidian';

/**
 * Fuzzy picker over every folder in the vault, including the root. The
 * placeholder is parameterised so the same modal can serve both the CSV
 * export command and the tangles-exclusion settings UI without each
 * caller subclassing for cosmetic differences.
 */
export class FolderPickerModal extends FuzzySuggestModal<TFolder> {

	private readonly onSelect: (folder: TFolder) => void;

	constructor(app: App, onSelect: (folder: TFolder) => void, placeholder = 'Choose a folder') {
		super(app);
		this.onSelect = onSelect;
		this.setPlaceholder(placeholder);
	}

	getItems(): TFolder[] {
		const out: TFolder[] = [];
		const walk = (folder: TFolder) => {
			out.push(folder);
			for (const child of folder.children) {
				if (child instanceof TFolder) walk(child);
			}
		};
		walk(this.app.vault.getRoot());
		return out;
	}

	getItemText(folder: TFolder): string {
		return folder.path === '' || folder.path === '/'
			? '/ (vault root)'
			: folder.path;
	}

	onChooseItem(folder: TFolder): void {
		this.onSelect(folder);
	}
}

/**
 * Fuzzy picker over every markdown file in the vault. Surfaces note
 * basename in the primary text and the full path as a muted secondary
 * line so the user can disambiguate two notes that share a basename
 * without having to remember which folder they're in.
 */
export class NoteFuzzyPickerModal extends FuzzySuggestModal<TFile> {

	private readonly onSelect: (file: TFile) => void;

	constructor(app: App, onSelect: (file: TFile) => void, placeholder = 'Type to find a note') {
		super(app);
		this.onSelect = onSelect;
		this.setPlaceholder(placeholder);
	}

	getItems(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	getItemText(file: TFile): string {
		// Fuzzy match runs against this string, so include both basename
		// and path — users typically remember one or the other.
		return `${file.basename}  ${file.path}`;
	}

	onChooseItem(file: TFile): void {
		this.onSelect(file);
	}
}
