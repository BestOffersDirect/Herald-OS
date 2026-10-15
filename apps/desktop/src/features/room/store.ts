import type { ApprovalChoice } from '@herald-os/client'
import { atom } from 'nanostores'
import type { RoomState } from './model/types.ts'

/*
 * CONTRACT STUB: the room-store worker replaces these bodies and keeps these exports and their
 * signatures (it may add more).
 */

export const EMPTY_ROOM: RoomState = {
  epoch: null,
  agents: {},
  seen: {},
  handoffs: [],
  toolProgress: null,
  caps: { activeList: true, eventsSince: true, delegation: true, config: true },
  updatedAt: 0
}

/** Every live piece of Hermes work in Herald's backend, as the Room shows it. */
export const $room = atom<RoomState>(EMPTY_ROOM)

/** Keep the Room fed (polling and live frames) while something shows it; returns the release. */
export function retainRoom(): () => void {
  return () => undefined
}

/** React: keep the Room fed while the component is mounted and `active` (false while its window is minimized). */
export function useRoomFeed(active = true): void {
  void active
}

/** One look at Hermes now, for `room.status` when the Room is not open. */
export async function refreshRoomOnce(): Promise<RoomState> {
  return $room.get()
}

/** Answer the plain approval an agent holds up, through Herald's own approval flow; false when it is not pending. */
export async function answerRoomApproval(agentId: string, choice: ApprovalChoice): Promise<boolean> {
  void agentId
  void choice

  return false
}

/** Open the agent's conversation in Hermes (a helper opens its parent's). */
export function openRoomAgent(agentId: string): void {
  void agentId
}
