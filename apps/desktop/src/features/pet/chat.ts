import { atom, computed } from 'nanostores'
import { PET_EMPTY_CHAT, type PetChat } from '../../../shared/pet.ts'
import { $backend } from '../../store/backend.ts'
import { $activeChatId, $chats, createChat, interruptChat, sendPrompt } from '../../store/chat.ts'
import { $connection } from '../../store/gateway.ts'
import { isPanels, openSurface } from '../../store/shell.ts'
import { showPage } from '../../store/windows.ts'
import { petChatFrom } from './chat-model.ts'

/*
 * The pet's conversation with Hermes: a Herald session of its own, started quietly in the
 * background on the first question, the way an Office window's Ask Hermes bar starts one, so its
 * turns never notify and its replies show as the pet's speech bubbles. Open in Hermes shows the whole
 * conversation in the Hermes window.
 */

/** Added to what the person asks: the reply lands in a small bubble. Never shown back to them. */
export const PET_BRIEF = '\n\n(Asked through the desktop pet: a short answer fits its speech bubble.)'

export const $petSessionId = atom<string | null>(null)
const $petError = atom<string | null>(null)

export const $petChat = computed([$chats, $petSessionId, $petError], (chats, sessionId, error): PetChat => {
  const chat = sessionId ? petChatFrom(chats[sessionId], 0, sessionId) : PET_EMPTY_CHAT
  const messages = chat.messages.map(message => (message.role === 'user' && message.text.endsWith(PET_BRIEF) ? { ...message, text: message.text.slice(0, -PET_BRIEF.length) } : message))

  return { ...chat, messages, error: chat.error ?? (chat.working ? null : error) }
})

const reachable = (): string | null => {
  if ($backend.get().phase === 'failed') {
    return 'Hermes is offline right now: ask again once it is back'
  }

  return $backend.get().phase === 'ready' && $connection.get() === 'open' ? null : 'Hermes is still starting: ask again in a moment'
}

export function setPetError(error: string | null): void {
  $petError.set(error)
}

/** Ask Hermes something in the pet's session; false when it did not start (empty, or Hermes is busy with the last one). */
export async function askPet(text: string): Promise<boolean> {
  const words = text.trim()
  const current = $petSessionId.get()
  const known = current && $chats.get()[current] ? current : null

  if (!words || (known && $chats.get()[known]?.streaming)) {
    return false
  }

  const problem = reachable()

  if (problem) {
    $petError.set(problem)

    return false
  }

  $petError.set(null)

  try {
    const sessionId = known ?? (await createChat({ title: `Pet · ${words.slice(0, 48)}`, activate: false })).sessionId
    $petSessionId.set(sessionId)
    await sendPrompt(`${words}${PET_BRIEF}`, { sessionId })

    return true
  } catch (error) {
    $petError.set(`Could not reach Hermes: ${error instanceof Error ? error.message : String(error)}`)

    return false
  }
}

export async function stopPet(): Promise<void> {
  const sessionId = $petSessionId.get()

  if (sessionId && $chats.get()[sessionId]?.streaming) {
    await interruptChat(sessionId).catch(() => undefined)
  }
}

/** Start over: the next question opens a new session (the last one stays in Hermes's list). */
export function newPetChat(): void {
  $petSessionId.set(null)
  $petError.set(null)
}

/** Show a conversation in the Hermes window, raising it in panels mode. */
export function openInHermesWindow(sessionId: string | null): void {
  const chat = sessionId ? (Object.values($chats.get()).find(entry => entry.sessionId === sessionId || entry.storedSessionId === sessionId) ?? null) : null

  if (chat) {
    $activeChatId.set(chat.sessionId)
  }

  showPage('hermes')

  if (isPanels) {
    openSurface('main')
  }
}

export function openPetChatInHermes(): void {
  openInHermesWindow($petSessionId.get())
}
