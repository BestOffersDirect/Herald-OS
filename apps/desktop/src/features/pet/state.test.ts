import { describe, expect, it } from 'vitest'
import { PET_PREFS_DEFAULTS, type PetReaction } from '../../../shared/pet.ts'
import type { AssistantMessage, ChatMessage, SystemMessage, ToolMessage } from '../../lib/chat-model.ts'
import { derivePetActivity, nextBeatEnd, PET_BEATS, type PetSignals, stepOf, turnEndOf, turnErrorOf } from './state.ts'

const NOW = 100_000
const calm: PetSignals = { approval: false, working: false, toolRunning: false, reasoning: false, listening: false, cheerAt: null, errorAt: null, wakeAt: null }
const busy: PetSignals = { approval: false, working: true, toolRunning: true, reasoning: true, listening: true, cheerAt: NOW, errorAt: NOW, wakeAt: NOW }
const allOn = PET_PREFS_DEFAULTS.reactions
const without = (...off: PetReaction[]): Record<PetReaction, boolean> => ({ ...allOn, ...Object.fromEntries(off.map(reaction => [reaction, false])) })

const user = (text: string): ChatMessage => ({ id: `u-${text}`, role: 'user', text, ts: 0 })
const reply = (text: string, extra: Partial<AssistantMessage> = {}): AssistantMessage => ({ id: `a-${text}`, role: 'assistant', text, reasoning: '', streaming: false, ts: 0, ...extra })
const tool = (name: string, args: Record<string, unknown> | null, running: boolean): ToolMessage => ({ id: `t-${name}`, role: 'tool', toolId: name, name, args, running, ts: 0 })
const system = (text: string, level: SystemMessage['level'] = 'error'): SystemMessage => ({ id: `s-${text}`, role: 'system', text, level, ts: 0 })

describe('derivePetActivity', () => {
  it('puts an approval first, whatever else goes on and whatever is turned off', () => {
    expect(derivePetActivity({ ...busy, approval: true }, allOn, NOW)).toBe('waiting')
    expect(derivePetActivity({ ...busy, approval: true }, without('thinking', 'running', 'cheering', 'drooping', 'listening'), NOW)).toBe('waiting')
  })

  it('orders the rest: drooping, cheering, listening, running, thinking, idle', () => {
    expect(derivePetActivity(busy, allOn, NOW)).toBe('drooping')
    expect(derivePetActivity({ ...busy, errorAt: null }, allOn, NOW)).toBe('cheering')
    expect(derivePetActivity({ ...busy, errorAt: null, cheerAt: null }, allOn, NOW)).toBe('listening')
    expect(derivePetActivity({ ...busy, errorAt: null, cheerAt: null, listening: false }, allOn, NOW)).toBe('listening')
    expect(derivePetActivity({ ...busy, errorAt: null, cheerAt: null, listening: false, wakeAt: null }, allOn, NOW)).toBe('running')
    expect(derivePetActivity({ ...calm, working: true }, allOn, NOW)).toBe('thinking')
    expect(derivePetActivity({ ...calm, reasoning: true }, allOn, NOW)).toBe('thinking')
    expect(derivePetActivity({ ...calm, toolRunning: true }, allOn, NOW)).toBe('idle')
    expect(derivePetActivity(calm, allOn, NOW)).toBe('idle')
  })

  it('ends each beat after its length', () => {
    expect(derivePetActivity({ ...calm, cheerAt: NOW }, allOn, NOW + PET_BEATS.cheer - 1)).toBe('cheering')
    expect(derivePetActivity({ ...calm, cheerAt: NOW }, allOn, NOW + PET_BEATS.cheer)).toBe('idle')
    expect(derivePetActivity({ ...calm, errorAt: NOW }, allOn, NOW + PET_BEATS.error - 1)).toBe('drooping')
    expect(derivePetActivity({ ...calm, errorAt: NOW }, allOn, NOW + PET_BEATS.error)).toBe('idle')
    expect(derivePetActivity({ ...calm, wakeAt: NOW }, allOn, NOW + PET_BEATS.wake - 1)).toBe('listening')
    expect(derivePetActivity({ ...calm, wakeAt: NOW, working: true }, allOn, NOW + PET_BEATS.wake)).toBe('thinking')
    expect(PET_BEATS).toEqual({ cheer: 2600, error: 3600, wake: 2400 })
  })

  it('falls through a reaction turned off to the next rule', () => {
    const atWork = { ...calm, working: true, toolRunning: true }

    expect(derivePetActivity(atWork, without('running'), NOW)).toBe('thinking')
    expect(derivePetActivity(atWork, without('running', 'thinking'), NOW)).toBe('idle')
    expect(derivePetActivity({ ...calm, errorAt: NOW, cheerAt: NOW }, without('drooping'), NOW)).toBe('cheering')
    expect(derivePetActivity({ ...atWork, cheerAt: NOW }, without('cheering'), NOW)).toBe('running')
    expect(derivePetActivity({ ...calm, wakeAt: NOW, listening: true }, without('listening'), NOW)).toBe('idle')
  })
})

describe('nextBeatEnd', () => {
  it('says when the soonest beat ends, and null with none going', () => {
    expect(nextBeatEnd(calm, NOW)).toBeNull()
    expect(nextBeatEnd({ ...calm, cheerAt: NOW - 1000, errorAt: NOW - 100 }, NOW)).toBe(PET_BEATS.cheer - 1000)
    expect(nextBeatEnd({ ...calm, cheerAt: NOW - 5000, wakeAt: NOW - 400 }, NOW)).toBe(PET_BEATS.wake - 400)
    expect(nextBeatEnd({ ...calm, cheerAt: NOW - PET_BEATS.cheer }, NOW)).toBeNull()
  })

  it('never waits longer than a beat, even for one stamped ahead of the clock', () => {
    expect(nextBeatEnd({ ...calm, wakeAt: NOW + 60_000 }, NOW)).toBe(PET_BEATS.wake)
  })
})

describe('turnEndOf', () => {
  it('ends ok with a reply, even after a problem it answered through', () => {
    expect(turnEndOf([user('Hi'), reply('Hello')])).toBe('ok')
    expect(turnEndOf([user('Hi'), reply('Here it is'), system('The tool failed once')])).toBe('ok')
    expect(turnEndOf([user('Hi')])).toBe('ok')
    expect(turnErrorOf([user('Hi'), reply('Hello')])).toBeNull()
  })

  it('ends in an error when the reply failed, or a problem came with no answer', () => {
    expect(turnEndOf([user('Hi'), reply('', { status: 'error', error: 'Rate limited' })])).toBe('error')
    expect(turnErrorOf([user('Hi'), reply('', { status: 'error', error: 'Rate limited' })])).toBe('Rate limited')
    expect(turnErrorOf([user('Hi'), system('Connection lost')])).toBe('Connection lost')
    expect(turnErrorOf([user('Hi'), reply('  '), system('Connection lost')])).toBe('Connection lost')
    expect(turnErrorOf([user('Hi'), reply('', { status: 'error' })])).toBe('Hermes could not finish this request')
    expect(turnEndOf([user('Hi'), system('Just so you know', 'warn')])).toBe('ok')
  })

  it('ends interrupted when Hermes was stopped', () => {
    expect(turnEndOf([user('Hi'), reply('Half an ans', { status: 'interrupted' })])).toBe('interrupted')
    expect(turnErrorOf([user('Hi'), reply('Half an ans', { status: 'interrupted' })])).toBeNull()
  })
})

describe('stepOf', () => {
  it('is null once the turn has stopped streaming', () => {
    expect(stepOf([user('Hi'), tool('web_search', {}, true)], false)).toBeNull()
  })

  it('thinks while streaming with no tool running', () => {
    expect(stepOf([user('Hi')], true)).toBe('Thinking')
    expect(stepOf([user('Hi'), tool('web_search', {}, false), reply('Found')], true)).toBe('Thinking')
  })

  it('names the last running tool the way the Office bar does', () => {
    expect(stepOf([tool('docs', { action: 'read' }, true)], true)).toBe('Reading the document')
    expect(stepOf([tool('os_ui', { action: 'run', command: 'docs.open' }, true)], true)).toBe('docs · open')
    expect(stepOf([tool('cronjob', { action: 'create' }, true)], true)).toBe('cronjob · create')
    expect(stepOf([tool('read_file', {}, true), tool('docs', { action: 'read' }, false), tool('web_search', { query: 'q' }, true)], true)).toBe('Searching the web')
  })

  it('says what Hermes is doing in words for its own tools, never a raw command line', () => {
    expect(stepOf([tool('terminal', { command: 'cat notes.txt' }, true)], true)).toBe('Running a command')
    expect(stepOf([tool('github_create_issue', null, true)], true)).toBe('Using github create issue')
    expect(stepOf([tool('constructor', null, true)], true)).toBe('Using constructor')
  })
})
