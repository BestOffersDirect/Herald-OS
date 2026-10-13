import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appendUser, emptyChat } from '../../lib/chat-model.ts'
import { $backend } from '../../store/backend.ts'
import { $activeChatId, $chats } from '../../store/chat.ts'
import { $connection } from '../../store/gateway.ts'
import { $page } from '../../store/windows.ts'
import { $petChat, $petSessionId, askPet, newPetChat, openPetChatInHermes, PET_BRIEF } from './chat.ts'

// The stores read the preload bridge and the viewport when they load; tests run without a DOM.
vi.hoisted(() => {
  Object.assign(globalThis, {
    window: { innerWidth: 1440, innerHeight: 900, matchMedia: () => ({ matches: true }), setTimeout: (run: () => void) => setTimeout(run, 0) },
    document: { documentElement: { dataset: {} } }
  })
})

const calls = vi.hoisted(() => ({ created: [] as { title?: string; activate?: boolean }[], sent: [] as { text: string; sessionId?: string }[] }))

vi.mock('../../store/chat.ts', async importOriginal => {
  const original = await importOriginal<typeof import('../../store/chat.ts')>()

  return {
    ...original,
    createChat: vi.fn(async (options: { title?: string; activate?: boolean }) => {
      calls.created.push(options)
      const state = emptyChat(`pet-${calls.created.length}`, `stored-${calls.created.length}`)
      original.$chats.setKey(state.sessionId, state)

      return state
    }),
    sendPrompt: vi.fn(async (text: string, options: { sessionId?: string }) => {
      calls.sent.push({ text, sessionId: options.sessionId })
      const sid = options.sessionId!
      original.$chats.setKey(sid, { ...appendUser(original.$chats.get()[sid], text), streaming: true })

      return sid
    })
  }
})

function reply(sessionId: string, text: string): void {
  const chat = $chats.get()[sessionId]
  $chats.setKey(sessionId, { ...chat, streaming: false, messages: [...chat.messages, { id: `a-${text.length}`, role: 'assistant', text, reasoning: '', streaming: false, status: 'complete', ts: 2 }] })
}

describe('the pet’s chat with Hermes', () => {
  beforeEach(() => {
    calls.created.length = 0
    calls.sent.length = 0
    $chats.set({})
    $activeChatId.set(null)
    newPetChat()
    $backend.set({ phase: 'ready', attempt: 0, logTail: [] } as never)
    $connection.set('open')
  })

  afterEach(() => {
    $backend.set({ phase: 'idle', attempt: 0, logTail: [] } as never)
    $connection.set('idle')
  })

  it('starts a quiet background session of its own and asks there', async () => {
    expect(await askPet('  What is on my calendar?  ')).toBe(true)

    expect(calls.created).toEqual([{ title: 'Pet · What is on my calendar?', activate: false }])
    expect(calls.sent).toEqual([{ text: `What is on my calendar?${PET_BRIEF}`, sessionId: 'pet-1' }])
    expect($petSessionId.get()).toBe('pet-1')
    expect($activeChatId.get()).toBeNull()
  })

  it('shows the person’s words without the note for Hermes, and the reply as a speech bubble', async () => {
    await askPet('Hello')
    expect($petChat.get()).toMatchObject({ sessionId: 'pet-1', working: true })

    reply('pet-1', 'Hi there.')
    const shown = $petChat.get()

    expect(shown.working).toBe(false)
    expect(shown.messages.map(message => [message.role, message.text])).toEqual([
      ['user', 'Hello'],
      ['hermes', 'Hi there.']
    ])
  })

  it('keeps the conversation going in the same session, one question at a time', async () => {
    await askPet('First')
    expect(await askPet('Too soon')).toBe(false)

    reply('pet-1', 'Answered.')
    expect(await askPet('Second')).toBe(true)
    expect(calls.created).toHaveLength(1)
    expect(calls.sent.map(sent => sent.sessionId)).toEqual(['pet-1', 'pet-1'])
  })

  it('starts over in a new session after New chat', async () => {
    await askPet('First')
    reply('pet-1', 'Done.')
    newPetChat()

    await askPet('Again')
    expect(calls.created).toHaveLength(2)
    expect($petSessionId.get()).toBe('pet-2')
  })

  it('says so instead of asking when Hermes cannot be reached', async () => {
    $connection.set('closed' as never)

    expect(await askPet('Anyone there?')).toBe(false)
    expect(calls.created).toHaveLength(0)
    expect($petChat.get().error).toMatch(/starting|offline/)
  })

  it('opens the conversation in the Hermes window', async () => {
    await askPet('Hello')
    openPetChatInHermes()

    expect($activeChatId.get()).toBe('pet-1')
    expect($page.get()).toBe('hermes')
  })
})
