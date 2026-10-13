import { IconArrowUpRight, IconLoader2, IconPlayerStopFilled, IconPlus, IconSend, IconX } from '@tabler/icons-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import type { PetChat } from '../../../shared/pet.ts'
import { cn } from '../../lib/cn.ts'
import { bubbleText } from './chat-model.ts'

/** The pet's chat: what Hermes is doing now, the last few exchanges as speech bubbles, and a box to ask. */
export function PetBubble({
  chat,
  step,
  inputRef,
  onAsk,
  onStop,
  onOpen,
  onNew,
  onClose
}: {
  chat: PetChat
  step: string | null
  inputRef?: RefObject<HTMLInputElement | null>
  onAsk: (text: string) => void
  onStop: () => void
  onOpen: () => void
  onNew: () => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const ownInput = useRef<HTMLInputElement>(null)
  const input = inputRef ?? ownInput
  const last = chat.messages.at(-1)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [chat.messages.length, last?.text])

  const submit = () => {
    const words = text.trim()

    if (!words || chat.working) {
      return
    }

    onAsk(words)
    setText('')
  }

  return (
    <div className="float pointer-events-auto flex w-[300px] flex-col gap-2 rounded-2xl p-3 animate-pop">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 text-[12.5px] font-medium">Ask Hermes</div>
        {chat.sessionId && (
          <button type="button" aria-label="New chat" title="New chat" onClick={onNew} className="flex size-6 items-center justify-center rounded-md text-fg-3 hover:bg-white/10 hover:text-fg">
            <IconPlus size={14} />
          </button>
        )}
        <button type="button" aria-label="Close" onClick={onClose} className="flex size-6 items-center justify-center rounded-md text-fg-3 hover:bg-white/10 hover:text-fg">
          <IconX size={14} />
        </button>
      </div>
      {step && (
        <div className="flex items-center gap-1.5 rounded-lg bg-white/6 px-2.5 py-1.5 text-[12px] text-fg-2">
          <IconLoader2 size={13} className="shrink-0 animate-spin text-progress motion-reduce:animate-none" />
          <span className="min-w-0 truncate">{step}</span>
        </div>
      )}
      {chat.messages.length > 0 && (
        <div ref={listRef} className="selectable flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-0.5">
          {chat.messages.map(message => {
            const shown = message.role === 'hermes' ? bubbleText(message.text) : { text: message.text, cut: false }

            return (
              <div key={message.id} className={cn('max-w-[88%] rounded-xl px-2.5 py-1.5 text-[12.5px] leading-snug whitespace-pre-wrap', message.role === 'user' ? 'self-end bg-accent-soft text-fg' : 'self-start bg-white/8 text-fg')}>
                {shown.text}
                {shown.cut && (
                  <button type="button" onClick={onOpen} className="mt-1 block text-[11.5px] text-accent-strong hover:underline">
                    The rest is in Hermes
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {chat.error && <div className="text-[12px] text-danger">{chat.error}</div>}
      <div className="flex items-center gap-1.5">
        <input
          ref={input}
          value={text}
          onChange={event => setText(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
            }
          }}
          placeholder={chat.working ? 'Hermes is answering…' : 'Ask Hermes anything'}
          aria-label="Ask Hermes"
          className="glass-input h-8 min-w-0 flex-1 rounded-lg px-2.5 text-[12.5px] outline-none"
        />
        {chat.working ? (
          <button type="button" aria-label="Stop" title="Stop" onClick={onStop} className="flex size-8 items-center justify-center rounded-lg bg-white/8 text-fg-2 hover:bg-white/12 hover:text-fg">
            <IconPlayerStopFilled size={13} />
          </button>
        ) : (
          <button type="button" aria-label="Send" disabled={!text.trim()} onClick={submit} className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-fg disabled:opacity-40">
            <IconSend size={14} />
          </button>
        )}
      </div>
      {chat.sessionId && (
        <button type="button" onClick={onOpen} className="flex items-center gap-1 self-start text-[12px] text-accent-strong hover:underline">
          Open in Hermes
          <IconArrowUpRight size={13} />
        </button>
      )}
    </div>
  )
}
