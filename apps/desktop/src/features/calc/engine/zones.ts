import type { TimeContext, TimeOutcome } from './dates.ts'

/*
 * Times of day across time zones: "9am Sydney in New York", "now in Tokyo". The platform's Intl
 * zone data only; nothing is fetched.
 */

/** A line about times of day or zones: the answer, a gentle error, or null when it names no time. */
export function evaluateZoneLine(_text: string, _context: TimeContext): TimeOutcome {
  return null
}

/** The IANA zone a place or abbreviation names ("Sydney", "new york", "PST", "UTC+3", "Europe/Paris"), or null. */
export function findZone(_name: string): string | null {
  return null
}

/** Every place and abbreviation findZone knows, lower-case, for the voice grammar. */
export function zoneNames(): readonly string[] {
  return []
}
