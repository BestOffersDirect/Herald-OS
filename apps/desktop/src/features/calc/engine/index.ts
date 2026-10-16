import type { CalcContext, CalcValue, CompiledFunction, DocumentResult, EvalResult, FormatOptions } from './types.ts'

/*
 * Herald Calc's exact engine: math.js (its own chunk, loaded on first use) for exact numbers,
 * units and functions, with Herald's own parser for the sentence forms on top. Every caller goes
 * through these functions.
 */

export type { CalcContext, CalcValue, CompiledFunction, DocumentResult, EvalResult, FormatOptions, LineResult, PlotFunction } from './types.ts'

/** Load math.js once; the calls below wait for it themselves. */
export async function loadEngine(): Promise<void> {
  throw new Error('not implemented')
}

/** Every line of a note, each with its result; names assigned on a line count on the lines after it. */
export async function evaluateDocument(_text: string, _context: CalcContext): Promise<DocumentResult> {
  throw new Error('not implemented')
}

/** One sentence or expression (or several lines, read as a note): the value, its units and the working. Never throws. */
export async function evaluate(_text: string, _context: CalcContext): Promise<EvalResult> {
  throw new Error('not implemented')
}

/** `amount` (a number, or a quantity like "5 ft 3 in") from one unit or currency to another. Never throws. */
export async function convert(_amount: string, _from: string, _to: string, _context: CalcContext): Promise<EvalResult> {
  throw new Error('not implemented')
}

/** A function of `variable` (x when left out) to draw, fast enough to call thousands of times a frame; throws when it does not read. */
export async function compileFunction(_expression: string, _options: { variable?: string; scope?: Record<string, number> } = {}): Promise<CompiledFunction> {
  throw new Error('not implemented')
}

/** A value as the notepad shows it, or in words to speak. Needs no math.js. */
export function formatValue(_value: CalcValue, _options: FormatOptions = {}): string {
  throw new Error('not implemented')
}
