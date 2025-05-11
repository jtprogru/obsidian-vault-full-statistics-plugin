export interface Tokenizer {
    tokenize(content: string): Array<string>;
}

/**
 * The {@link UnitTokenizer} is a constant tokenizer that always returns an
 * empty list.
 */
class UnitTokenizer implements Tokenizer {
    public tokenize(_: string): Array<string> {
        return [];
    }
}

/**
 * {@link MarkdownTokenizer} understands how to tokenize markdown text into word
 * tokens.
 */
class MarkdownTokenizer implements Tokenizer {
    private static readonly NON_WORDS = /^[^\wа-яА-ЯёЁ]+$/;
    private static readonly NUMBER = /^\d+(\.\d+)?$/;
    private static readonly CODE_BLOCK_HEADER = /^```\w+$/;
    private static readonly STRIP_HIGHLIGHTS = /^(==)?(.*?)(==)?$/;
    private static readonly STRIP_FORMATTING = /^(_+|\*+)?(.*?)(_+|\*+)?$/;
    private static readonly STRIP_PUNCTUATION = /^(`|\.|:|"|,|!|\?)?(.*?)(`|\.|:|"|,|!|\?)?$/;
    private static readonly STRIP_WIKI_LINKS = /^(\[\[)?(.*?)(\]\])?$/;
    private static readonly STRIP_URLS = /\[.*?\]\((.*?)\)/g;
    private static readonly WORD_BOUNDARY = /[ \n\r\t\"\|,\(\)\[\]/]+/;

    private isNonWord(token: string): boolean {
        return MarkdownTokenizer.NON_WORDS.test(token);
    }

    private isNumber(token: string): boolean {
        return MarkdownTokenizer.NUMBER.test(token);
    }

    private isCodeBlockHeader(token: string): boolean {
        return MarkdownTokenizer.CODE_BLOCK_HEADER.test(token);
    }

    private stripHighlights(token: string): string {
        const match = MarkdownTokenizer.STRIP_HIGHLIGHTS.exec(token);
        return match ? match[2] : token;
    }

    private stripFormatting(token: string): string {
        const match = MarkdownTokenizer.STRIP_FORMATTING.exec(token);
        return match ? match[2] : token;
    }

    private stripPunctuation(token: string): string {
        const match = MarkdownTokenizer.STRIP_PUNCTUATION.exec(token);
        return match ? match[2] : token;
    }

    private stripWikiLinks(token: string): string {
        const match = MarkdownTokenizer.STRIP_WIKI_LINKS.exec(token);
        return match ? match[2] : token;
    }

    private stripUrls(token: string): string {
        return token.replace(MarkdownTokenizer.STRIP_URLS, '$1');
    }

    private stripAll(token: string): string {
		let prev;
		do {
			prev = token;
			token = this.stripHighlights(token);
			token = this.stripFormatting(token);
			token = this.stripPunctuation(token);
			token = this.stripWikiLinks(token);
			token = this.stripUrls(token);
		} while (token !== prev);
		return token;
	}

    private stripMarkdownLinks(token: string): string {
        return token.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    }

    public tokenize(content: string): Array<string> {
        if (content.trim() === "") {
            return [];
        }

        content = this.stripMarkdownLinks(content);

        return content
            .split(MarkdownTokenizer.WORD_BOUNDARY)
            .filter(token => !this.isNonWord(token))
            .filter(token => !this.isNumber(token))
            .filter(token => !this.isCodeBlockHeader(token))
            .map(token => this.stripAll(token))
            .filter(token => token.length > 0);
    }
}

export const UNIT_TOKENIZER = new UnitTokenizer();
export const MARKDOWN_TOKENIZER = new MarkdownTokenizer();

export function unit_tokenize(_: string): Array<string> {
    return UNIT_TOKENIZER.tokenize(_);
}

export function markdown_tokenize(content: string): Array<string> {
    return MARKDOWN_TOKENIZER.tokenize(content);
}

/**
 * Извлекает все теги вида #тег, включая вложенные, эмодзи и спецсимволы.
 * Возвращает массив уникальных тегов (с #, как в Obsidian).
 */
export function extract_tags_from_text(content: string): string[] {
    // Тег начинается с #, за которым следует хотя бы один неразделительный символ,
    // допускает вложенность (например, #inbox/simple), эмодзи, спецсимволы, Unicode
    // Не включает # внутри слов (например, foo#bar не считается тегом)
    // Тег заканчивается на пробел, знак препинания или конец строки
    const tagRegex = /(^|[\s.,:;!?()[\]{}"'`~])#([\p{L}\p{N}_\-/\p{Emoji_Presentation}\p{Emoji}\p{S}]+)(?=[\s.,:;!?()[\]{}"'`~]|$)/gu;
    const tags = new Set<string>();
    let match;
    while ((match = tagRegex.exec(content)) !== null) {
        tags.add('#' + match[2]);
    }
    return Array.from(tags);
}
