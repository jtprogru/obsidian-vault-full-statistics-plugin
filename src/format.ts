export abstract class Formatter {
	public abstract format(value: number): string;
}

/**
 * {@link DecimalUnitFormatter} provides an implementation of {@link Formatter}
 * that outputs a integers in a standard decimal format with grouped thousands.
 */
export class DecimalUnitFormatter extends Formatter {
	private unit: string;
	private numberFormat: Intl.NumberFormat;

	/**
	 * @param unit the unit of the value being formatted.
	 * @constructor
	 */
	constructor(unit: string) {
		super()
		this.unit = unit;
		this.numberFormat = Intl.NumberFormat('en-US', { style: 'decimal' });
	}

	public format(value: number): string {
		return `${this.numberFormat.format(value)} ${this.unit}`
	}
}
