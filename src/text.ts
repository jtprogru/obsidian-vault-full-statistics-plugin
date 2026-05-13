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

export const UNIT_TOKENIZER = new UnitTokenizer();

// Matches sequences of Unicode letters/digits, optionally joined by an
// internal apostrophe or hyphen (so "We're" and "по-русски" are one word).
// CJK characters are stripped beforehand and counted separately because each
// glyph is conventionally treated as a single word in word-count tools.
const WORD_REGEX = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const CJK_REGEX = /[぀-ゟ゠-ヿ一-鿿가-힯]/gu;

/**
 * Counts words across any language in raw markdown content. The algorithm:
 *  1. Strip frontmatter, fenced/inline code, HTML, image embeds, and URLs.
 *  2. Replace markdown link syntax with the visible text only.
 *  3. Count each CJK character as one word, then match Unicode word tokens
 *     in what remains.
 *
 * Code blocks are excluded because the metric is meant to track prose volume.
 */
export function countWords(content: string): number {
    if (!content) return 0;
    const stripped = stripMarkdownNoise(content);

    let cjkCount = 0;
    const text = stripped.replace(CJK_REGEX, () => {
        cjkCount++;
        return ' ';
    });

    const matches = text.match(WORD_REGEX);
    return cjkCount + (matches ? matches.length : 0);
}

function stripMarkdownNoise(content: string): string {
    let s = content;
    // Frontmatter at the very start: --- ... ---
    s = s.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
    // Fenced code blocks
    s = s.replace(/```[\s\S]*?```/g, ' ');
    s = s.replace(/~~~[\s\S]*?~~~/g, ' ');
    // Inline code
    s = s.replace(/`[^`\n]+`/g, ' ');
    // Image embeds (Obsidian) and standard markdown images
    s = s.replace(/!\[\[[^\]]*\]\]/g, ' ');
    s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
    // Wikilinks: keep the alias if present, otherwise the target name
    s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, alias) => alias ?? target);
    // Standard markdown links: keep the visible text
    s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    // HTML tags
    s = s.replace(/<[^>]+>/g, ' ');
    // Bare URLs
    s = s.replace(/https?:\/\/\S+/g, ' ');
    return s;
}
