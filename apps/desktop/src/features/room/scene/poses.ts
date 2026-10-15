import { frameAt, type PetPose, poseRow, type SheetLayout } from '../../pet/sprite.ts'
import type { RoomAgent } from '../model/types.ts'

/** The pose for what an agent is doing; walking wins over everything. */
export function poseOf(agent: Pick<RoomAgent, 'phase' | 'result'>, walking: -1 | 0 | 1): PetPose {
  if (walking) {
    return walking < 0 ? 'walk-left' : 'walk-right'
  }

  switch (agent.phase) {
    case 'idle':
      return 'idle'
    case 'thinking':
    case 'starting':
    case 'queued':
      return 'review'
    case 'tool':
      return 'run'
    case 'waiting':
      return 'waiting'
    case 'finished':
      return agent.result?.status === 'completed' ? 'jump' : 'failed'
  }
}

/** Poses that play a couple of loops and then hold: resting, and a finished helper's cheer or droop. */
const SETTLES: ReadonlySet<PetPose> = new Set<PetPose>(['idle', 'jump', 'failed'])

export interface Cell {
  row: number
  frame: number
  mirror: boolean
  /** When the next frame is due (a `Date.now()` time); null when this frame holds. */
  nextAt: number | null
}

/** The frame a pet in `pose` since `since` shows at `now`; `still` holds every pose on one frame. */
export function cellAt(pose: PetPose, layout: SheetLayout, since: number, now: number, still: boolean): Cell {
  const { row, frames, mirror } = poseRow(pose, layout)
  const step = frameAt(SETTLES.has(pose) ? 'idle' : pose, frames, now - since, still)
  // A held pose other than idle shows its middle frame: a row's first frame is often the plain standing one.
  const frame = step.nextMs === null && pose !== 'idle' ? Math.floor(frames / 2) : step.frame

  return { row, frame, mirror, nextAt: step.nextMs === null ? null : now + step.nextMs }
}

/** About one display frame, for ticks while something walks or fades. */
export const MOVING_TICK_MS = 16

/**
 * When the scene needs its next tick: a frame from now while anything walks or fades, else the
 * earliest of the pets' next sprite frames and `extra` (a bubble or note due to change); null when
 * everything rests.
 */
export function nextWake(now: number, moving: boolean, cells: Iterable<{ nextAt: number | null }>, extra: number | null = null): number | null {
  if (moving) {
    return now + MOVING_TICK_MS
  }

  let earliest = extra

  for (const cell of cells) {
    if (cell.nextAt !== null && (earliest === null || cell.nextAt < earliest)) {
      earliest = cell.nextAt
    }
  }

  return earliest === null ? null : Math.max(earliest, now + 1)
}
