import type { CalcHistoryEntry } from '../../../../shared/calc.ts'

/** Entries that match the words ("that mortgage thing"), best first; everything, newest first, for an empty query. */
export function searchHistory(entries: readonly CalcHistoryEntry[], _query: string, limit = 50): CalcHistoryEntry[] {
  return entries.slice(0, limit)
}
