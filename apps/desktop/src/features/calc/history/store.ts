import { atom } from 'nanostores'
import type { CalcHistoryEntry, CalcHistoryInput } from '../../../../shared/calc.ts'

/** The history, newest first, as main last sent it. */
export const $calcHistory = atom<CalcHistoryEntry[]>([])

/** Read the history and follow changes from every window. */
export async function loadHistory(): Promise<void> {}

/** Keep a calculation; fire and forget, never throws, and the same input and result twice in a row is kept once. */
export function recordCalc(_entry: CalcHistoryInput): void {}

export async function clearHistory(): Promise<void> {}
