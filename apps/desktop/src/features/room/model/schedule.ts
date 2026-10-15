import type { RoomAgent, RoomPhase, RoomState } from './types.ts'

/*
 * When each of the Room's calls is next due: often while agents work, rarely when it is quiet.
 * Pure: the binding keeps the clock, runs what is due and sleeps until the next time this says.
 */

export const ROOM_TIMING = {
  listBusyMs: 3_000,
  listQuietMs: 15_000,
  /** After `sessions.changed`, the list is read again this soon. */
  listChangedMs: 500,
  eventsBusyMs: 1_000,
  eventsIdleMs: 10_000,
  /** A session whose frames came live this recently skips a read... */
  liveSkipMs: 2_000,
  /** ...but is read at least this often, so its open requests stay fresh. */
  eventsFloorMs: 10_000,
  helpersBusyMs: 2_000,
  helpersQuietMs: 20_000,
  configMs: 60_000
} as const

/** When the Room last asked for each thing (when the request was sent), and when live frames last came. */
export interface RoomClock {
  listAt: number | null
  /** The first list since the Room started answered (or failed): the other calls wait for it. */
  listed: boolean
  /** When `sessions.changed` last arrived after the list was asked for. */
  changedAt: number | null
  helpersAt: number | null
  configAt: number | null
  /** Per live session. */
  polledAt: Record<string, number>
  liveAt: Record<string, number>
}

/** Due times (ms); Infinity is never. */
export interface RoomDue {
  activeList: number
  delegation: number
  config: number
  sessions: Record<string, number>
}

export function emptyClock(): RoomClock {
  return { listAt: null, listed: false, changedAt: null, helpersAt: null, configAt: null, polledAt: {}, liveAt: {} }
}

const BUSY = new Set<RoomPhase>(['starting', 'thinking', 'tool', 'waiting', 'queued'])
const SESSION_BUSY = new Set<RoomPhase>(['starting', 'thinking', 'tool', 'waiting'])

function sessionDue(agent: RoomAgent, clock: RoomClock): number {
  const polled = clock.polledAt[agent.sessionId]

  if (polled === undefined) {
    return 0
  }

  const base = polled + (SESSION_BUSY.has(agent.phase) ? ROOM_TIMING.eventsBusyMs : ROOM_TIMING.eventsIdleMs)
  const live = clock.liveAt[agent.sessionId]

  if (live === undefined || live + ROOM_TIMING.liveSkipMs <= base) {
    return base
  }

  return Math.min(live + ROOM_TIMING.liveSkipMs, polled + ROOM_TIMING.eventsFloorMs)
}

/** When each call is due. `paused` sessions are not read at all (this window holds a request for them). */
export function roomDue(state: RoomState, clock: RoomClock, paused: ReadonlySet<string> = new Set()): RoomDue {
  const agents = Object.values(state.agents)
  const helpers = agents.some(agent => agent.kind === 'helper' && agent.phase !== 'finished')
  const busy = helpers || agents.some(agent => BUSY.has(agent.phase))
  const delegating = helpers || agents.some(agent => agent.tool === 'delegate_task')
  const waitForList = state.caps.activeList && !clock.listed
  let activeList = clock.listAt === null ? 0 : clock.listAt + (busy ? ROOM_TIMING.listBusyMs : ROOM_TIMING.listQuietMs)

  if (clock.changedAt !== null) {
    activeList = Math.min(activeList, clock.changedAt + ROOM_TIMING.listChangedMs)
  }

  const sessions: Record<string, number> = {}

  if (state.caps.eventsSince && !waitForList) {
    for (const agent of agents) {
      if (agent.kind !== 'helper' && agent.sessionId && !paused.has(agent.sessionId)) {
        sessions[agent.sessionId] = sessionDue(agent, clock)
      }
    }
  }

  return {
    activeList: state.caps.activeList ? activeList : Infinity,
    delegation: state.caps.delegation && !waitForList ? (clock.helpersAt === null ? 0 : clock.helpersAt + (delegating ? ROOM_TIMING.helpersBusyMs : ROOM_TIMING.helpersQuietMs)) : Infinity,
    config: state.caps.config && !waitForList ? (clock.configAt === null ? 0 : clock.configAt + ROOM_TIMING.configMs) : Infinity,
    sessions
  }
}

/** The earliest due time among calls not already in flight. */
export function earliestDue(due: RoomDue, inflight: { list: boolean; helpers: boolean; config: boolean; sessions: ReadonlySet<string> }): number {
  const times = [inflight.list ? Infinity : due.activeList, inflight.helpers ? Infinity : due.delegation, inflight.config ? Infinity : due.config]

  for (const [sessionId, at] of Object.entries(due.sessions)) {
    times.push(inflight.sessions.has(sessionId) ? Infinity : at)
  }

  return Math.min(...times)
}
