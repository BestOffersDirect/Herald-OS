import { factsOf } from './facts.ts'
import type { RoomAgent, RoomPhase, RoomState } from './types.ts'

export interface RoomSummary {
  total: number
  working: number
  waiting: number
  idle: number
  helpers: number
  /** One line per agent, from the fixed tables: "Budget review (mission): reading Budget.xlsx". */
  lines: string[]
}

const WORKING = new Set<RoomPhase>(['starting', 'thinking', 'tool', 'queued'])
/** Facts worth reading out after the step, when they are true. */
const SPOKEN_FACTS = new Set(['quiet', 'repeat', 'guardrail'])
const ORDER: Record<RoomPhase, number> = { waiting: 0, tool: 1, thinking: 1, starting: 1, queued: 1, idle: 2, finished: 3 }

const capitalized = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

function kindWords(agent: RoomAgent, state: RoomState): string {
  if (agent.kind !== 'helper') {
    return agent.kind
  }

  const parent = agent.parentId ? state.agents[agent.parentId] : undefined

  return `helper of ${parent?.title || (parent ? `a ${parent.kind}` : 'a conversation')}`
}

function lineOf(agent: RoomAgent, state: RoomState, now: number): string {
  const kind = kindWords(agent, state)
  const name = agent.title ? `${agent.title} (${kind})` : capitalized(kind)
  const facts = factsOf(agent, state, now)
  const doing = agent.step ?? facts.find(fact => fact.kind === 'idle')?.text ?? 'idle'
  const notes = facts.filter(fact => SPOKEN_FACTS.has(fact.kind)).map(fact => fact.text)

  return `${name}: ${[doing, ...notes].join(', ')}`
}

/** What the Room shows now, for `room.status`: counts, then a line per agent at work, waiting first. Finished helpers are on their way out and left out. */
export function summarizeRoom(state: RoomState, now: number): RoomSummary {
  const agents = Object.values(state.agents)
    .filter(agent => agent.phase !== 'finished')
    .sort((a, b) => ORDER[a.phase] - ORDER[b.phase] || (a.startedAt ?? a.lastEventAt) - (b.startedAt ?? b.lastEventAt) || a.id.localeCompare(b.id))

  return {
    total: agents.length,
    working: agents.filter(agent => WORKING.has(agent.phase)).length,
    waiting: agents.filter(agent => agent.phase === 'waiting').length,
    idle: agents.filter(agent => agent.phase === 'idle').length,
    helpers: agents.filter(agent => agent.kind === 'helper').length,
    lines: agents.map(agent => lineOf(agent, state, now))
  }
}
