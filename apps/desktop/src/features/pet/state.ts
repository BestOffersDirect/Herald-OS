import type { PetActivity, PetReaction } from '../../../shared/pet.ts'
import type { AssistantMessage, ChatMessage, SystemMessage, ToolMessage } from '../../lib/chat-model.ts'
import { stepLabel } from '../office/hermes/prompts.ts'

/*
 * What the pet shows, from what Hermes is doing. An approval waiting on the person always shows;
 * the end of a turn and the wake word are beats, a few seconds of cheering, drooping or perking up.
 */

export interface PetSignals {
  /** An approval waits on the person. */
  approval: boolean
  /** A Hermes turn is running. */
  working: boolean
  toolRunning: boolean
  reasoning: boolean
  /** A voice conversation is listening. */
  listening: boolean
  /** A turn or task finished cleanly. */
  cheerAt: number | null
  /** A turn failed. */
  errorAt: number | null
  /** The wake word heard the person. */
  wakeAt: number | null
}

export const PET_BEATS: { cheer: number; error: number; wake: number } = { cheer: 2600, error: 3600, wake: 2400 }

/** What is left of a beat that started at `at`, never more than the beat itself (a clock set back). */
const beatLeft = (at: number | null, length: number, now: number): number => (at === null ? 0 : Math.min(length, at + length - now))

export function derivePetActivity(signals: PetSignals, reactions: Record<PetReaction, boolean>, now: number): PetActivity {
  if (signals.approval) {
    return 'waiting'
  }

  const order: [PetReaction, boolean][] = [
    ['drooping', beatLeft(signals.errorAt, PET_BEATS.error, now) > 0],
    ['cheering', beatLeft(signals.cheerAt, PET_BEATS.cheer, now) > 0],
    ['listening', signals.listening || beatLeft(signals.wakeAt, PET_BEATS.wake, now) > 0],
    ['running', signals.working && signals.toolRunning],
    ['thinking', signals.working || signals.reasoning]
  ]

  return order.find(([reaction, on]) => on && reactions[reaction])?.[0] ?? 'idle'
}

export function nextBeatEnd(signals: PetSignals, now: number): number | null {
  const left = [beatLeft(signals.cheerAt, PET_BEATS.cheer, now), beatLeft(signals.errorAt, PET_BEATS.error, now), beatLeft(signals.wakeAt, PET_BEATS.wake, now)].filter(ms => ms > 0)

  return left.length ? Math.min(...left) : null
}

export type TurnEnd = 'ok' | 'error' | 'interrupted'

/** How a finished turn ended, by the rules the Office windows' Ask Hermes bar follows. */
function outcomeOf(turn: readonly ChatMessage[]): { end: TurnEnd; error: string | null } {
  const replies = turn.filter((message): message is AssistantMessage => message.role === 'assistant')
  const last = replies.at(-1)
  const answered = replies.some(message => message.text.trim())
  const problem = turn.find((message): message is SystemMessage => message.role === 'system' && message.level === 'error')

  if (last?.status === 'error' || (problem && !answered)) {
    return { end: 'error', error: last?.error || problem?.text || 'Hermes could not finish this request' }
  }

  return { end: last?.status === 'interrupted' ? 'interrupted' : 'ok', error: null }
}

export function turnEndOf(turn: readonly ChatMessage[]): TurnEnd {
  return outcomeOf(turn).end
}

/** What went wrong, when a finished turn ended in an error. */
export function turnErrorOf(turn: readonly ChatMessage[]): string | null {
  return outcomeOf(turn).error
}

/** Hermes's own tools in a few words: `stepLabel` gives their bare names, and a terminal call's raw command line. */
const TOOL_STEPS: Record<string, string> = {
  terminal: 'Running a command',
  execute_code: 'Running code',
  read_file: 'Reading a file',
  write_file: 'Writing a file',
  patch: 'Editing a file',
  search_files: 'Searching files',
  web_search: 'Searching the web',
  web_extract: 'Reading a web page',
  browser_navigate: 'Browsing the web',
  vision_analyze: 'Looking at an image',
  delegate_task: 'Delegating work',
  todo: 'Updating the plan',
  todo_list: 'Updating the plan',
  memory: 'Updating memory',
  skill_view: 'Reading a skill',
  system_info: 'Checking the system',
  system_processes: 'Inspecting processes',
  system_disk_usage: 'Measuring disk usage',
  system_find_files: 'Searching for files',
  system_apps: 'Listing apps',
  system_open: 'Opening something',
  system_kill_process: 'Stopping a process',
  system_files: 'Organising files'
}

function toolStep(name: string, args?: Record<string, unknown> | null): string {
  if (Object.hasOwn(TOOL_STEPS, name)) {
    return TOOL_STEPS[name]
  }

  const label = stepLabel(name, args)

  return label === name ? `Using ${name.replace(/_/g, ' ')}` : label
}

export function stepOf(turn: readonly ChatMessage[], streaming: boolean): string | null {
  if (!streaming) {
    return null
  }

  const tool = turn.findLast((message): message is ToolMessage => message.role === 'tool' && message.running)

  return tool ? toolStep(tool.name, tool.args) : 'Thinking'
}
