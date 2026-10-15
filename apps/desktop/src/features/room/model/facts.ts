import type { RoomGuardrailCode } from './frames.ts'
import type { RoomAgent, RoomFact, RoomPhase, RoomResult, RoomState } from './types.ts'

/** A turn with nothing new for this long is quiet. */
export const QUIET_AFTER_MS = 60_000
/** The same call this many times in a row is worth saying. */
export const REPEAT_AFTER = 3

const TURN_PHASES = new Set<RoomPhase>(['starting', 'thinking', 'tool'])

const GUARDRAIL_TEXT: Record<RoomGuardrailCode, (tool: string) => string> = {
  repeated_exact_failure_block: tool => `Hermes stopped a failing call to ${tool}`,
  same_tool_failure_halt: tool => `Hermes stopped a failing call to ${tool}`,
  idempotent_no_progress_block: tool => `Hermes stopped a repeating call to ${tool}`,
  identical_call_streak_halt: tool => `Hermes stopped a repeating call to ${tool}`,
  identical_cycle_halt: tool => `Hermes stopped a repeating call to ${tool}`,
  loop_web_search_cap: () => 'Hermes hit its web search limit',
  loop_subagent_cap: () => 'Hermes hit its helper limit'
}

const RESULT_TEXT: Record<RoomResult['status'], string> = {
  completed: 'done',
  failed: 'could not finish',
  error: 'could not finish',
  timeout: 'ran out of time',
  interrupted: 'was stopped'
}

/** A span as a fact says it: whole minutes, then whole hours. */
export function spanOf(ms: number): string {
  const minutes = Math.max(1, Math.floor(ms / 60_000))

  if (minutes < 60) {
    return minutes === 1 ? '1 minute' : `${minutes} minutes`
  }

  const hours = Math.floor(minutes / 60)

  return hours === 1 ? '1 hour' : `${hours} hours`
}

/** What is true about an agent now, as facts from its records ('quiet for 4 minutes during a turn', 'same call 3 times'). */
export function factsOf(agent: RoomAgent, state: RoomState, now: number): RoomFact[] {
  const facts: RoomFact[] = []
  const { trace } = agent

  if (agent.approval) {
    facts.push({ kind: 'waiting', text: 'waiting for your OK', trace: trace.approval ?? null })
  }

  if (agent.asking) {
    facts.push({ kind: 'asking', text: 'waiting for you in Hermes', trace: trace.asking ?? null })
  } else if (agent.phase === 'waiting' && !agent.approval) {
    facts.push({ kind: 'asking', text: 'waiting for you in Hermes', trace: trace.phase ?? null })
  }

  if (agent.guardrail) {
    facts.push({ kind: 'guardrail', text: GUARDRAIL_TEXT[agent.guardrail.code as RoomGuardrailCode]?.(agent.guardrail.tool) ?? `Hermes stopped a call to ${agent.guardrail.tool}`, trace: trace.guardrail ?? null })
  }

  if (agent.repeat && agent.repeat.count >= REPEAT_AFTER) {
    facts.push({ kind: 'repeat', text: `same call ${agent.repeat.count} times`, trace: trace.repeat ?? null })
  }

  if (TURN_PHASES.has(agent.phase) && now - agent.lastEventAt >= QUIET_AFTER_MS) {
    facts.push({ kind: 'quiet', text: `quiet for ${spanOf(now - agent.lastEventAt)} during a turn`, trace: trace.lastEventAt ?? null })
  }

  if (agent.phase === 'idle') {
    const since = agent.basis?.idleSince ?? agent.lastEventAt

    facts.push({ kind: 'idle', text: now - since >= 60_000 ? `idle for ${spanOf(now - since)}` : 'idle', trace: trace.phase ?? null })
  }

  if (agent.phase === 'finished') {
    facts.push({ kind: 'result', text: agent.result ? RESULT_TEXT[agent.result.status] : 'finished', trace: trace.result ?? trace.phase ?? null })
  }

  if (state.toolProgress === 'off' && agent.kind !== 'helper' && (agent.phase === 'thinking' || agent.phase === 'tool')) {
    facts.push({ kind: 'toolsHidden', text: "tool steps hidden: Hermes's tool progress is off", trace: state.toolProgressTrace ?? null })
  }

  return facts
}
