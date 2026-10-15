import type { RoomKind } from '../../../../shared/room.ts'

/*
 * The Room's records: one per agent, folded from what Hermes reports (frames from a session's
 * event buffer or the live stream, `session.active_list` rows, `delegation.status` records and
 * open requests). Every field says where it came from, and nothing here holds chat text, file
 * content, tool arguments or Hermes's thinking: frames are cut down to the facts below on arrival.
 */

export type { RoomKind }

/** Where a pet stands: a work area for the tool it uses, the bench while it waits on the person, the lounge when it rests. */
export type RoomArea = 'docs' | 'sheets' | 'slides' | 'canvas' | 'terminal' | 'browser' | 'files' | 'studio' | 'memory' | 'messages' | 'bench' | 'lounge'

export const ROOM_AREAS: readonly RoomArea[] = ['docs', 'sheets', 'slides', 'canvas', 'terminal', 'browser', 'files', 'studio', 'memory', 'messages', 'bench', 'lounge']

/**
 * What an agent is doing. Sessions: idle, starting (Hermes builds its agent), thinking (a turn
 * runs with no tool), tool (a tool runs), waiting (a request waits on the person). Helpers: queued,
 * then thinking or tool, then finished once their result is back (`result` says how it ended).
 */
export type RoomPhase = 'idle' | 'starting' | 'thinking' | 'tool' | 'waiting' | 'queued' | 'finished'

/** Where a value came from: a frame (with its seq) or a record from one of Hermes's methods. */
export type RoomSource = 'frame' | 'active_list' | 'delegation' | 'open_request' | 'local_request' | 'session_list' | 'config'

export interface RoomTrace {
  source: RoomSource
  /** The frame's type (`tool.start`) or the method's name (`session.active_list`). */
  type: string
  /** The frame's per-session seq, for frames. */
  seq?: number
  /** When the Room received it: Hermes's frames carry no time. */
  at: number
}

/** The fields a trace is kept for. */
export type RoomField = 'kind' | 'title' | 'parent' | 'phase' | 'area' | 'target' | 'step' | 'approval' | 'asking' | 'repeat' | 'guardrail' | 'result' | 'lastEventAt'

/** A plain approval waiting on the person, with only what Herald's approval card shows. */
export interface RoomApproval {
  /** The approval's own id (`params.request_id`), which `approval.respond` names. */
  requestId: string
  /** The server request's JSON-RPC id, which the window that holds it answers through. */
  rpcId: string | null
  /** The live session it waits in. */
  sessionId: string
  params: {
    description: string | null
    command: string | null
    tool_name: string | null
    choices: string[] | null
    allow_permanent: boolean | null
    allow_session: boolean | null
  }
}

/** How a helper's work ended, from `subagent.complete`. */
export interface RoomResult {
  status: 'completed' | 'failed' | 'error' | 'timeout' | 'interrupted'
  /** Hermes's own summary of the result, cut to a short bubble. */
  summary: string | null
  durationSeconds: number | null
  filesRead: number | null
  filesWritten: number | null
  at: number
}

export interface RoomAgent {
  /** `s:<live session id>` for sessions, `h:<subagent id>` for helpers. */
  id: string
  kind: RoomKind
  /** The live session it is (sessions) or reports through (helpers: its parent conversation's). */
  sessionId: string
  /** The stored session id (`session_key`), which opens the conversation in Hermes. */
  sessionKey: string | null
  /** The session's title or the helper's goal, trimmed; empty when Hermes has none yet. */
  title: string
  /** Helpers: the agent that spawned it (a session or another helper). */
  parentId: string | null
  phase: RoomPhase
  area: RoomArea
  /** What the step works on: a file or document name, a web host, an app; never content. */
  target: string | null
  /** A label from the Room's fixed tables ('reading Budget.xlsx'); null when there is nothing to say. */
  step: string | null
  /** The running tool's name, as Hermes names it. */
  tool: string | null
  /** When the work started (ms), from Hermes's records. */
  startedAt: number | null
  /** When the turn under way started (ms); null between turns. */
  turnStartedAt: number | null
  /** When the Room last received a frame or record that touched this agent. */
  lastEventAt: number
  approval: RoomApproval | null
  /** A request other than a plain approval waits on the person in Hermes; pets never answer these. */
  asking: 'clarify' | 'sudo' | 'secret' | 'other' | null
  /** The same tool call (same name and arguments, compared by a hash) in a row. */
  repeat: { signature: string; count: number } | null
  /** Hermes's tool-loop guardrail stopped a call. */
  guardrail: { tool: string; code: string; at: number } | null
  /** Helpers: how their work ended. */
  result: RoomResult | null
  /** Helpers: tools used so far, from `delegation.status` or `subagent.*` frames. */
  toolCount: number | null
  trace: Partial<Record<RoomField, RoomTrace>>
  /** What the Room works the phase, area and step out from; nothing to draw. */
  basis?: RoomBasis
}

/** Hermes's word for a session: `session.active_list`'s status, or what a turn's frames say. */
export type RoomLiveStatus = 'idle' | 'starting' | 'working' | 'waiting'

export interface RoomBasis {
  status: RoomLiveStatus | null
  /** When the status was true: a record's request time, a polled frame's request time, a live frame's receipt. */
  statusAt: number
  /** The newest frame evidence for the agent, on the same clock as `statusAt`. */
  frameAt: number
  /** Tools running now, by Hermes's tool id. */
  tools: string[]
  /** The running tool's area, target and step from the fixed tables. */
  toolArea: RoomArea | null
  toolTarget: string | null
  toolStep: string | null
  /** The area and target of the turn's last tool, where the agent thinks between tools. */
  turnArea: RoomArea | null
  turnTarget: string | null
  /** The session's working folder, by name. */
  cwd: string | null
  /** The session keeps a todo list (a mission). */
  todo: boolean
  /** When the Room saw the agent go idle; null when it was idle when the Room first saw it. */
  idleSince: number | null
  /** Helpers: their own session, which `session.active_list` lists while someone watches it. */
  childSessionId: string | null
  /** Helpers: `delegation.status` listed it at least once. */
  listed: boolean
  /** Helpers: `delegation.status` polls in a row that did not list it. */
  missing: number
}

/** A stored session row from Herald's session list: its title and where it came from, never its preview. */
export interface RoomSessionMeta {
  id: string
  title: string
  source: string | null
}

/** Something true about an agent, said as a fact rather than a verdict ('quiet for 4 minutes during a turn'). */
export interface RoomFact {
  kind: 'waiting' | 'asking' | 'idle' | 'quiet' | 'repeat' | 'guardrail' | 'result' | 'toolsHidden'
  text: string
  /** The record or frame the fact rests on. */
  trace: RoomTrace | null
}

/** A note walked from a parent to a helper it spawned, or a result walked back. */
export interface RoomHandoff {
  id: string
  kind: 'note' | 'result'
  from: string
  to: string
  at: number
  trace: RoomTrace
}

/** Which of Hermes's methods answered; a method-not-found turns its part of the Room off. */
export interface RoomCaps {
  activeList: boolean
  eventsSince: boolean
  delegation: boolean
  config: boolean
}

export interface RoomState {
  /** The backend process's replay epoch the watermarks belong to. */
  epoch: string | null
  agents: Record<string, RoomAgent>
  /** The highest seq applied, per live session, in `epoch`. */
  seen: Record<string, number>
  handoffs: RoomHandoff[]
  /** Hermes's `display.tool_progress` (from `config.get`); 'off' means tool frames do not come. */
  toolProgress: 'all' | 'new' | 'verbose' | 'off' | null
  caps: RoomCaps
  /** When the Room last heard from Hermes at all. */
  updatedAt: number
  /** Stored session rows by stored id, for titles and kinds. */
  meta?: Record<string, RoomSessionMeta>
  /** Approvals answered from here, by request id, so a poll that raced the answer does not raise the sign again. */
  answered?: Record<string, number>
  /** Approvals this window holds (its own cards), for sessions the Room has yet to see. */
  local?: RoomApproval[]
  /** Where `toolProgress` came from. */
  toolProgressTrace?: RoomTrace | null
}
