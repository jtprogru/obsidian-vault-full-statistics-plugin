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
