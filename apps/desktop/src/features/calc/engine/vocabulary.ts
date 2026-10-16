/*
 * The words the engine reads, for the voice fast path's math grammar. Plain data: importing this
 * never loads math.js.
 */

/** Every word or symbol read as a unit ("km", "kilometres", "miles", "°f", "fahrenheit", "sq ft"), lower-case. */
export const UNIT_WORDS: ReadonlySet<string> = new Set()

/** Currency ISO codes, names and symbols ("usd", "dollars", "euro", "€", "reais"), lower-case. */
export const CURRENCY_WORDS: ReadonlySet<string> = new Set()

/** Functions, constants and operator words ("sqrt", "square root", "sin", "pi", "plus", "divided by", "percent"), lower-case. */
export const MATH_WORDS: ReadonlySet<string> = new Set()
