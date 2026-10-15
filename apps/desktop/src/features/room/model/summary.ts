import type { RoomState } from './types.ts'

/*
 * CONTRACT STUB: the room-store worker replaces this body and keeps the exports and signatures.
 */

export interface RoomSummary {
  total: number
  working: number
  waiting: number
  idle: number
  helpers: number
  /** One line per agent, from the fixed tables: "Budget review: reading Budget.xlsx". */
  lines: string[]
}

export function summarizeRoom(state: RoomState, now: number): RoomSummary {
  void now

  return { total: Object.keys(state.agents).length, working: 0, waiting: 0, idle: 0, helpers: 0, lines: [] }
}
