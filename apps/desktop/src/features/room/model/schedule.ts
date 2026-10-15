import { isDeskArea } from './desks.ts'
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
  configMs: 60_000,
  /** Herald's automations: while a run is under way, and when none is. */
  jobsBusyMs: 30_000,
  jobsQuietMs: 120_000,
  /** After `cron.changed` (a job was edited, or a run started or ended), the list is read again this soon. */
  jobsChangedMs: 1_000,
  /** A job's latest run: while it runs, and otherwise; a job whose record moved is read at once and again this soon after. */
  runsBusyMs: 15_000,
  runsQuietMs: 300_000,
  runsRecheckMs: 5_000,
  /** The elsewhere lane, while it is on: at most once a minute. */
  elsewhereMs: 60_000,
  /** The open documents: while an agent works in Office or Canvas, and otherwise. */
  desksBusyMs: 2_000,
  desksQuietMs: 10_000
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
  jobsAt: number | null
  /** When `cron.changed` last arrived after the automations were asked for. */
  jobsChangedAt: number | null
  /** Per job key: when its runs were last read, and when they are wanted again sooner than usual. */
  runsAt: Record<string, number>
  runsWanted: Record<string, number>
  elsewhereAt: number | null
  desksAt: number | null
}

/** Due times (ms); Infinity is never. */
export interface RoomDue {
  activeList: number
  delegation: number
  config: number
  sessions: Record<string, number>
  automations: number
  /** Per job key. */
  runs: Record<string, number>
  elsewhere: number
  desks: number
}

export interface RoomInflight {
  list: boolean
  helpers: boolean
  config: boolean
  sessions: ReadonlySet<string>
  automations: boolean
  elsewhere: boolean
  desks: boolean
}

export function emptyClock(): RoomClock {
  return { listAt: null, listed: false, changedAt: null, helpersAt: null, configAt: null, polledAt: {}, liveAt: {}, jobsAt: null, jobsChangedAt: null, runsAt: {}, runsWanted: {}, elsewhereAt: null, desksAt: null }
}

const BUSY = new Set<RoomPhase>(['starting', 'thinking', 'tool', 'waiting', 'queued'])
const SESSION_BUSY = new Set<RoomPhase>(['starting', 'thinking', 'tool', 'waiting'])
const AT_WORK = new Set<RoomPhase>(['starting', 'thinking', 'tool'])

const ownWork = (agent: RoomAgent): boolean => agent.id.startsWith('s:') || agent.kind === 'helper'

/** An automation agent's job key (`a:<key>`). */
export const jobKeyOf = (agent: Pick<RoomAgent, 'id'>): string | null => (agent.id.startsWith('a:') ? agent.id.slice(2) : null)

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

/** When each job's latest run is due: soon after its record moved, often while it runs, rarely otherwise. */
function runsDue(agents: readonly RoomAgent[], clock: RoomClock): Record<string, number> {
  const runs: Record<string, number> = {}

  for (const agent of agents) {
    const key = jobKeyOf(agent)

    if (!key) {
      continue
    }

    const read = clock.runsAt[key]
    const usual = read === undefined ? 0 : read + (agent.automation?.running ? ROOM_TIMING.runsBusyMs : ROOM_TIMING.runsQuietMs)

    runs[key] = Math.min(usual, clock.runsWanted[key] ?? Infinity)
  }

  return runs
}

/**
 * When each call is due. `paused` sessions are not read at all (this window holds a request for
 * them); the elsewhere lane is read only while the person has it on.
 */
export function roomDue(state: RoomState, clock: RoomClock, paused: ReadonlySet<string> = new Set(), options: { elsewhere: boolean } = { elsewhere: false }): RoomDue {
  const agents = Object.values(state.agents)
  const helpers = agents.some(agent => agent.kind === 'helper' && agent.phase !== 'finished')
  const busy = helpers || agents.some(agent => ownWork(agent) && BUSY.has(agent.phase))
  const delegating = helpers || agents.some(agent => agent.tool === 'delegate_task')
  const running = agents.some(agent => agent.automation?.running)
  const atDesks = agents.some(agent => ownWork(agent) && AT_WORK.has(agent.phase) && isDeskArea(agent.area))
  const waitForList = state.caps.activeList && !clock.listed
  let activeList = clock.listAt === null ? 0 : clock.listAt + (busy ? ROOM_TIMING.listBusyMs : ROOM_TIMING.listQuietMs)
  let automations = clock.jobsAt === null ? 0 : clock.jobsAt + (running ? ROOM_TIMING.jobsBusyMs : ROOM_TIMING.jobsQuietMs)

  if (clock.changedAt !== null) {
    activeList = Math.min(activeList, clock.changedAt + ROOM_TIMING.listChangedMs)
  }

  if (clock.jobsChangedAt !== null) {
    automations = Math.min(automations, clock.jobsChangedAt + ROOM_TIMING.jobsChangedMs)
  }

  const sessions: Record<string, number> = {}

  if (state.caps.eventsSince && !waitForList) {
    for (const agent of agents) {
      if (agent.id.startsWith('s:') && agent.sessionId && !paused.has(agent.sessionId)) {
        sessions[agent.sessionId] = sessionDue(agent, clock)
      }
    }
  }

  return {
    activeList: state.caps.activeList ? activeList : Infinity,
    delegation: state.caps.delegation && !waitForList ? (clock.helpersAt === null ? 0 : clock.helpersAt + (delegating ? ROOM_TIMING.helpersBusyMs : ROOM_TIMING.helpersQuietMs)) : Infinity,
    config: state.caps.config && !waitForList ? (clock.configAt === null ? 0 : clock.configAt + ROOM_TIMING.configMs) : Infinity,
    sessions,
    automations: state.caps.automations ? automations : Infinity,
    runs: state.caps.automations ? runsDue(agents, clock) : {},
    elsewhere: options.elsewhere && state.caps.sessionsDb ? (clock.elsewhereAt === null ? 0 : clock.elsewhereAt + ROOM_TIMING.elsewhereMs) : Infinity,
    desks: clock.desksAt === null ? 0 : clock.desksAt + (atDesks ? ROOM_TIMING.desksBusyMs : ROOM_TIMING.desksQuietMs)
  }
}

/** The earliest due time among calls not already in flight. Runs are read with the automations, so they wait while those are in flight. */
export function earliestDue(due: RoomDue, inflight: RoomInflight): number {
  const times = [
    inflight.list ? Infinity : due.activeList,
    inflight.helpers ? Infinity : due.delegation,
    inflight.config ? Infinity : due.config,
    inflight.automations ? Infinity : Math.min(due.automations, ...Object.values(due.runs)),
    inflight.elsewhere ? Infinity : due.elsewhere,
    inflight.desks ? Infinity : due.desks
  ]

  for (const [sessionId, at] of Object.entries(due.sessions)) {
    times.push(inflight.sessions.has(sessionId) ? Infinity : at)
  }

  return Math.min(...times)
}
