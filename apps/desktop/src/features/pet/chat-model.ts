import { PET_EMPTY_CHAT, type PetChat, type PetChatMessage } from '../../../shared/pet.ts'
import type { ChatState } from '../../lib/chat-model.ts'
import { truncate } from '../../lib/format.ts'
import { stepOf, turnErrorOf } from './state.ts'

export const PET_CHAT_KEEP = 6

const MESSAGE_CHARS = 1200

export function petChatFrom(chat: ChatState | undefined, from: number, sessionId: string | null): PetChat {
  if (!chat) {
    return { ...PET_EMPTY_CHAT, sessionId }
  }

  const shown = chat.messages.slice(Math.max(0, from))
  const turn = shown.slice(Math.max(0, shown.findLastIndex(message => message.role === 'user')))
  const messages = shown.flatMap((message): PetChatMessage[] => {
    const text = message.role === 'user' || message.role === 'assistant' ? message.text.trim() : ''

    return text ? [{ id: message.id, role: message.role === 'user' ? 'user' : 'hermes', text: truncate(text, MESSAGE_CHARS) }] : []
  })

  return {
    sessionId,
    messages: messages.slice(-PET_CHAT_KEEP),
    working: chat.streaming,
    step: stepOf(turn, chat.streaming),
    error: chat.streaming || !turn.length ? null : turnErrorOf(turn)
  }
}

const FENCE = /^[ \t]*(```|~~~).*$/gm
const HEADING = /^[ \t]{0,3}#{1,6}[ \t]+/gm
const LINK = /\[([^\]\n]+)\]\([^)\n]*\)/g
const BOLD = /(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g
const STAR_ITALIC = /(^|[^\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])/gm
const UNDERSCORE_ITALIC = /(^|[^\w_])_(?=\S)(.+?)(?<=\S)_(?![\w_])/gm
const STRIKE = /~~(?=\S)(.+?)(?<=\S)~~/g
const INLINE_CODE = /`([^`\n]+)`/g

export function bubbleText(text: string, max = 280): { text: string; cut: boolean } {
  const plain = text
    .replace(FENCE, '')
    .replace(HEADING, '')
    .replace(LINK, '$1')
    .replace(BOLD, '$2')
    .replace(STAR_ITALIC, '$1$2')
    .replace(UNDERSCORE_ITALIC, '$1$2')
    .replace(STRIKE, '$1')
    .replace(INLINE_CODE, '$1')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (plain.length <= max) {
    return { text: plain, cut: false }
  }

  const room = plain.slice(0, Math.max(0, max - 1))
  const words = /\s/.test(plain[room.length]) ? room : room.replace(/\s+\S*$/, '')
  const head = (words.length >= max / 2 ? words : room).replace(/[\s,;:.]+$/, '')

  return { text: `${head}…`, cut: true }
}
