import { numberFormat } from './i18n/format';

export abstract class Formatter {
	public abstract format(value: number): string;
}

/**
 * {@link DecimalUnitFormatter} provides an implementation of {@link Formatter}
 * that outputs a integers in a standard decimal format with grouped thousands.
 */
export class DecimalUnitFormatter extends Formatter {
	private label: string;

	/**
	 * @param label the already-localised label to append, e.g. "notes".
	 * @constructor
	 */
	constructor(label: string) {
		super()
		this.label = label;
	}

	public format(value: number): string {
		// Looked up per call rather than held in a field: the instance may
		// outlive a language switch, the cached formatter behind
		// numberFormat() never does.
		return `${numberFormat().format(value)} ${this.label}`
	}
}
