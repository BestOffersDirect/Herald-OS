import type { RoomAgent, RoomFact, RoomState } from './types.ts'

/*
 * CONTRACT STUB: the room-store worker replaces this body and keeps the export and its signature.
 */

/** What is true about an agent now, as facts from its records ('quiet for 4 minutes during a turn', 'same call 3 times'). */
export function factsOf(agent: RoomAgent, state: RoomState, now: number): RoomFact[] {
  void agent
  void state
  void now

  return []
}
