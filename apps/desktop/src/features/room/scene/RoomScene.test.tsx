// @vitest-environment happy-dom
import type { ApprovalChoice } from '@herald-os/client'
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import type { RoomAgent, RoomApproval } from '../model/types.ts'
import { EMPTY_ROOM_TEXT, roomNotices } from './labels.ts'
import { MAX_PETS } from './layout.ts'
import { RoomScene } from './RoomScene.tsx'

vi.hoisted(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

function agent(id: string, patch: Partial<RoomAgent> = {}): RoomAgent {
  return {
    id,
    kind: 'conversation',
    sessionId: 'live-1',
    sessionKey: 'stored-1',
    title: '',
    parentId: null,
    phase: 'idle',
    area: 'lounge',
    target: null,
    step: null,
    tool: null,
    startedAt: 1,
    turnStartedAt: null,
    lastEventAt: 1,
    approval: null,
    asking: null,
    repeat: null,
    guardrail: null,
    result: null,
    toolCount: null,
    desk: null,
    automation: null,
    elsewhere: null,
    trace: {},
    ...patch
  }
}

const approval: RoomApproval = {
  requestId: 'req-1',
  rpcId: 'rpc-1',
  sessionId: 'live-1',
  params: { description: 'Delete the old drafts', command: null, tool_name: null, choices: ['once', 'deny'], allow_permanent: null, allow_session: null }
}

let host: HTMLDivElement
let root: Root
let onOpen: Mock<(agentId: string) => void>
let onAnswer: Mock<(agentId: string, choice: ApprovalChoice) => void>

function render(props: Partial<ComponentProps<typeof RoomScene>> = {}) {
  act(() => {
    root.render(<RoomScene agents={[]} handoffs={[]} assignment={{}} installed={[]} steps motion="still" active={false} settled facts={{}} onOpen={onOpen} onAnswer={onAnswer} {...props} />)
  })
}

const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
const buttons = (text: string) => [...host.querySelectorAll('button')].filter(element => element.textContent?.trim() === text)

beforeEach(() => {
  onOpen = vi.fn<(agentId: string) => void>()
  onAnswer = vi.fn<(agentId: string, choice: ApprovalChoice) => void>()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('RoomScene', () => {
  it('gives every pet a real button that opens its conversation in Hermes', () => {
    render({ agents: [agent('s:1', { title: 'Budget review' }), agent('h:2', { kind: 'helper' })] })

    act(() => button('Open Budget review in Hermes')!.click())

    expect(onOpen).toHaveBeenCalledWith('s:1')
    expect(button('Open A helper in Hermes')).not.toBeNull()
  })

  it('shows what a pet is doing over it only while step bubbles are on', () => {
    const working = [agent('s:1', { phase: 'tool', area: 'sheets', step: 'reading Budget.xlsx' })]
    render({ agents: working })

    expect(host.textContent).toContain('Reading Budget.xlsx')

    render({ agents: working, steps: false })

    expect(host.textContent).not.toContain('Reading Budget.xlsx')
  })

  it('raises a sign for a plain approval that never takes the focus, and answers only on a click', () => {
    render({ agents: [agent('s:1', { title: 'Cleanup', phase: 'waiting', area: 'bench', approval })] })
    const sign = host.querySelector<HTMLButtonElement>('[data-room-sign="s:1"]')!

    expect(sign.textContent).toContain('Needs your OK')
    expect(sign.tabIndex).toBe(-1)

    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    sign.dispatchEvent(press)

    expect(press.defaultPrevented).toBe(true)
    expect(onAnswer).not.toHaveBeenCalled()

    act(() => sign.click())
    const [allow] = buttons('Allow once')

    expect(allow).toBeDefined()
    expect(host.textContent).toContain('Delete the old drafts')
    expect([...host.querySelectorAll('[role="group"] button')].every(element => (element as HTMLButtonElement).tabIndex === -1)).toBe(true)
    expect(document.activeElement === document.body || document.activeElement === null).toBe(true)
    expect(onAnswer).not.toHaveBeenCalled()

    const cardPress = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    allow.dispatchEvent(cardPress)

    expect(cardPress.defaultPrevented).toBe(true)

    act(() => allow.click())

    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer).toHaveBeenCalledWith('s:1', 'once')
    expect(buttons('Allow once')).toHaveLength(0)
  })

  it('closes the card on Escape without answering', () => {
    render({ agents: [agent('s:1', { phase: 'waiting', area: 'bench', approval })] })
    act(() => host.querySelector<HTMLButtonElement>('[data-room-sign="s:1"]')!.click())
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(buttons('Allow once')).toHaveLength(0)
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('never shows a clarify, sudo or secret prompt on a pet', () => {
    render({
      agents: [agent('s:1', { phase: 'waiting', area: 'bench', asking: 'sudo' }), agent('s:2', { phase: 'waiting', area: 'bench', asking: 'clarify' }), agent('s:3', { phase: 'waiting', area: 'bench', asking: 'secret' })],
      facts: { 's:1': [{ kind: 'asking', text: 'waiting for you in Hermes', trace: null }] }
    })

    expect(host.querySelector('[data-room-sign]')).toBeNull()
    expect(host.querySelector('input')).toBeNull()
    expect(host.textContent).not.toContain('Administrator password')
    expect(host.textContent).toContain('waiting for you in Hermes')
  })

  it('says the room is empty once Hermes has answered, and not before', () => {
    render({ settled: false })

    expect(host.textContent).not.toContain(EMPTY_ROOM_TEXT)

    render()

    expect(host.textContent).toContain(EMPTY_ROOM_TEXT)
  })

  it('draws the busiest pets and counts the rest', () => {
    const many = Array.from({ length: MAX_PETS + 6 }, (_, index) => agent(`s:${index}`, { title: `Chat ${index}`, lastEventAt: index }))
    render({ agents: many })

    expect(host.querySelectorAll('button[aria-label^="Open "]')).toHaveLength(MAX_PETS)
    expect(host.textContent).toContain('+6 more')
    expect(host.querySelectorAll('ul li')).toHaveLength(MAX_PETS + 6)
  })

  it('lists every agent with what it is doing and its facts for screen readers', () => {
    render({ agents: [agent('s:1', { title: 'Budget review', phase: 'tool', step: 'reading Budget.xlsx' })], facts: { 's:1': [{ kind: 'repeat', text: 'same call 3 times', trace: null }] } })

    expect(host.querySelector('ul li')?.textContent).toBe('Budget review: reading Budget.xlsx. same call 3 times.')
  })

  it('heads the room with its counts and notices, and leaves the header out for a screensaver', () => {
    const notices = roomNotices({ connected: false, state: { toolProgress: 'off', caps: { activeList: true, eventsSince: true, delegation: false, config: true, automations: true, sessionsDb: true } }, pets: 0 })
    const onPetSettings = vi.fn()
    render({ summary: { total: 3, working: 2, waiting: 1, idle: 0, helpers: 0, automations: 0, elsewhere: 0, lines: [] }, notices, onPetSettings })

    expect(host.textContent).toContain('Pet Room')
    expect(host.textContent).toContain('2 working')
    expect(host.textContent).toContain('1 waiting for you')
    expect(host.textContent).toContain('Hermes is not connected')
    expect(host.textContent).toContain('This Hermes cannot list its helpers yet: update Hermes')

    act(() => buttons('Open Settings')[0].click())

    expect(onPetSettings).toHaveBeenCalledTimes(1)

    render({ summary: { total: 3, working: 2, waiting: 1, idle: 0, helpers: 0, automations: 0, elsewhere: 0, lines: [] }, notices, chrome: false })

    expect(host.textContent).not.toContain('Pet Room')
    expect(host.textContent).not.toContain('Hermes is not connected')
  })

  it('shows no words at all as a screensaver, and nothing in it answers or opens', () => {
    render({
      agents: [
        agent('s:1', { title: 'Budget review', phase: 'tool', area: 'docs', step: 'working on Launch plan.docx', desk: 'docs:k1' }),
        agent('s:2', { title: 'Cleanup', phase: 'waiting', area: 'bench', approval })
      ],
      desks: [{ id: 'docs:k1', area: 'docs', name: 'Launch plan.docx', front: true, usedAt: 1 }],
      facts: { 's:1': [{ kind: 'meeting', text: '2 agents on Launch plan.docx', trace: null }] },
      chrome: false,
      names: false,
      deskNames: false,
      steps: false,
      interactive: false
    })

    expect(host.textContent?.trim()).toBe('')
    expect(host.querySelectorAll('button')).toHaveLength(0)
    expect(host.querySelector('[title]')).toBeNull()
    expect(host.querySelector('ul')).toBeNull()
    expect(onAnswer).not.toHaveBeenCalled()

    render({ agents: [agent('s:1', { title: 'Budget review', phase: 'tool', area: 'docs', step: 'working on Launch plan.docx' })], chrome: false, names: false, deskNames: false, steps: true, interactive: false })

    expect(host.textContent?.trim()).toBe('Working on Launch plan.docx')
  })

  it('puts the documents open in Office on desks, named only while desk names are on', () => {
    const desks = [{ id: 'docs:k1', area: 'docs' as const, name: 'Launch plan.docx', front: true, usedAt: 1 }]
    render({ desks })

    expect(host.textContent).toContain('Launch plan.docx')

    render({ desks, deskNames: false })

    expect(host.textContent).not.toContain('Launch plan.docx')
    expect(host.querySelector('[title="A document open in Herald Docs"]')).not.toBeNull()
  })

  it('shows work outside Herald in its lane only when the lane is on, and never opens it', () => {
    const outside = agent('e:bot', { kind: 'elsewhere', title: 'Support bot', phase: 'thinking', area: 'elsewhere', sessionId: '', elsewhere: { where: 'Telegram', active: true, lastActiveAt: 1 } })
    render({ agents: [outside] })

    expect(host.textContent).not.toContain('Support bot')

    render({ agents: [outside], lane: true, facts: { 'e:bot': [{ kind: 'activity', text: 'Telegram · active now', trace: null }] } })

    expect(host.textContent).toContain('Support bot')
    expect(host.textContent).toContain('Telegram · active now')
    expect(host.textContent).toContain('Outside Herald')
    expect(host.textContent).toContain("Coarse: titles and activity from Hermes's session list, once a minute")
    expect(button('Open Support bot in Hermes')).toBeNull()

    render({ agents: [], lane: true })

    expect(host.textContent).toContain('No Hermes work outside Herald in the last hour.')
  })
})
