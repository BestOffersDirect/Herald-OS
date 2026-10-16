import type { CalcValue } from './types.ts'

/*
 * Dates and durations in a sentence: "days until Dec 25", "3 weeks from today", "Mar 3 to Jun 9
 * in days". Calendar arithmetic in the person's zone through Intl; pure and synchronous.
 */

export interface TimeContext {
  now: number
  zone: string
  locale?: string
  /** Values named on earlier lines ("deadline = Dec 25"). */
  variables?: Record<string, CalcValue>
}

export interface TimeAnswer {
  value: CalcValue
  display: string
  steps: string[]
}

export type TimeOutcome = TimeAnswer | { error: string } | null

/** A line about dates: the answer, a gentle error, or null when the line names no date at all. */
export function evaluateDateLine(_text: string, _context: TimeContext): TimeOutcome {
  return null
}

/** A date the words name ("Dec 25", "25/12/2026", "2026-12-25", "today", "next Friday"): YYYY-MM-DD in the zone, or null. */
export function parseDate(_text: string, _context: TimeContext): string | null {
  return null
}
