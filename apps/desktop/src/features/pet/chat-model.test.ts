import { describe, expect, it } from 'vitest'
import { type AssistantMessage, type ChatMessage, type ChatState, emptyChat } from '../../lib/chat-model.ts'
import { bubbleText, PET_CHAT_KEEP, petChatFrom } from './chat-model.ts'

const user = (text: string, id = `u-${text}`): ChatMessage => ({ id, role: 'user', text, ts: 0 })
const reply = (text: string, extra: Partial<AssistantMessage> = {}): AssistantMessage => ({ id: `a-${text}`, role: 'assistant', text, reasoning: '', streaming: false, ts: 0, ...extra })
const chatOf = (messages: ChatMessage[], streaming = false): ChatState => ({ ...emptyChat('s1', 'stored-1'), messages, streaming })

describe('petChatFrom', () => {
  it('is empty for a session that is not loaded', () => {
    expect(petChatFrom(undefined, 0, 's1')).toEqual({ sessionId: 's1', messages: [], working: false, step: null, error: null })
  })

  it('keeps what the person and Hermes said with words in it, from the given message on', () => {
    const chat = chatOf([
      user('Earlier'),
      reply('Earlier reply'),
      user('  What is on today?  '),
      { id: 't1', role: 'tool', toolId: 't1', name: 'calendar', running: false, ts: 0 },
      { id: 's1', role: 'system', text: 'Model switched', level: 'info', ts: 0 },
      reply('   '),
      reply('Two meetings.')
    ])

    expect(petChatFrom(chat, 2, 's1').messages).toEqual([
      { id: 'u-  What is on today?  ', role: 'user', text: 'What is on today?' },
      { id: 'a-Two meetings.', role: 'hermes', text: 'Two meetings.' }
    ])
  })

  it('keeps the last few messages, each cut to 1200 characters', () => {
    const asks = Array.from({ length: 8 }, (_, n) => user(`Question ${n + 1}`))
    const messages = petChatFrom(chatOf([...asks, reply('x'.repeat(2000))]), 0, 's1').messages

    expect(PET_CHAT_KEEP).toBe(6)
    expect(messages.map(message => message.text.slice(0, 11))).toEqual(['Question 4', 'Question 5', 'Question 6', 'Question 7', 'Question 8', 'xxxxxxxxxxx'])
    expect(messages.at(-1)?.text).toHaveLength(1200)
    expect(messages.at(-1)?.text.endsWith('…')).toBe(true)
  })

  it('works with the step Hermes is on while the turn streams', () => {
    const chat = chatOf([user('Find the report'), { id: 't1', role: 'tool', toolId: 't1', name: 'search_files', running: true, ts: 0 }], true)

    expect(petChatFrom(chat, 0, 's1')).toMatchObject({ working: true, step: 'Searching files', error: null })
    expect(petChatFrom(chatOf([user('Hi')], true), 0, 's1').step).toBe('Thinking')
    expect(petChatFrom(chatOf([user('Hi'), reply('Hello')]), 0, 's1')).toMatchObject({ working: false, step: null })
  })

  it('says what went wrong when the last turn ended in an error', () => {
    const failed = [user('Do it'), reply('', { status: 'error', error: 'Model overloaded' })]

    expect(petChatFrom(chatOf(failed), 0, 's1').error).toBe('Model overloaded')
    expect(petChatFrom(chatOf(failed, true), 0, 's1').error).toBeNull()
    expect(petChatFrom(chatOf([...failed, user('Try again'), reply('Done.')]), 0, 's1').error).toBeNull()
    expect(petChatFrom(chatOf([user('Stop'), reply('Hal', { status: 'interrupted' })]), 0, 's1').error).toBeNull()
  })
})

describe('bubbleText', () => {
  it('takes light Markdown out', () => {
    const markdown = '# Title\n\nSome **bold**, *italic*, _under_ and ~~gone~~ text with `code`.\n\n```ts\nconst x = 1\n```\n[a link](https://example.com)'

    expect(bubbleText(markdown)).toEqual({ text: 'Title\n\nSome bold, italic, under and gone text with code.\n\nconst x = 1\n\na link', cut: false })
  })

  it('leaves snake_case names, sums and list bullets alone', () => {
    const text = 'Set file_name_here to 2 * 3 * 4.\n* first\n* second'

    expect(bubbleText(text)).toEqual({ text, cut: false })
  })

  it('cuts a long reply on a word boundary with an ellipsis', () => {
    const text = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu'

    expect(bubbleText(text, 30)).toEqual({ text: 'alpha beta gamma delta…', cut: true })
    expect(bubbleText(text, 23)).toEqual({ text: 'alpha beta gamma delta…', cut: true })
    expect(bubbleText('one, two, three, four', 10)).toEqual({ text: 'one, two…', cut: true })
  })

  it('cuts within a word only when one word fills the bubble', () => {
    const cut = bubbleText(`see ${'x'.repeat(400)}`)

    expect(cut.text).toHaveLength(280)
    expect(cut).toMatchObject({ text: `see ${'x'.repeat(275)}…`, cut: true })
  })

  it('keeps to 280 characters unless told otherwise', () => {
    const long = Array.from({ length: 200 }, (_, n) => `word${n}`).join(' ')

    expect(bubbleText(long).text.length).toBeLessThanOrEqual(280)
    expect(bubbleText(long, 100).text.length).toBeLessThanOrEqual(100)
    expect(bubbleText('Done.')).toEqual({ text: 'Done.', cut: false })
  })
})
