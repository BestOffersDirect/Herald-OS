import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalcRatesState } from '../../shared/calc.ts'
import { matchIntent } from '../lib/voice/intents.ts'
import { type CommandContext, defineCommands, resetCommands, runCommand } from '../store/os-commands.ts'
import { calcCommands } from './calc.ts'

// The calc commands with Herald Calc's real engine, graph helpers, vocabulary and places; only the
// preload bridge (the rates, the history) and the window are stand-ins.
const edges = vi.hoisted(() => {
  const rates: CalcRatesState = { rates: { base: 'EUR', date: '2026-10-15', fetchedAt: 0, rates: { EUR: 1, USD: 1.1, BRL: 6 } }, status: 'cached' }
  const calc = {
    rates: async () => rates,
    history: async () => [],
    addHistory: async () => undefined,
    clearHistory: async () => undefined,
    listNotes: async () => [],
    onChanged: () => () => undefined
  }

  Object.assign(globalThis, { window: { innerWidth: 1440, innerHeight: 900, heraldOS: { calc } } })

  return { opened: [] as unknown[] }
})

vi.mock('../features/calc/open.ts', () => ({ openCalc: (request: unknown) => void edges.opened.push(request) }))

const AGENT: CommandContext = { source: 'agent' }
const VOICE: CommandContext = { source: 'voice' }

const value = async (text: string, context: CommandContext = AGENT) => {
  const result = await runCommand('calc.eval', { text }, context)

  expect(result.ok, result.error).toBe(true)

  return result
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-16T01:00:00Z'))
})

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  resetCommands()
  defineCommands(calcCommands)
  edges.opened.length = 0
})

describe('Herald Calc commands with the real engine', () => {
  it('works exactly where floats do not', async () => {
    expect((await value('0.1 + 0.2')).data?.value).toBe('0.3')
    expect((await value('2^100')).data?.value).toBe('1267650600228229401496703205376')
  })

  it('gives a percentage with its working', async () => {
    const result = await value('20% of 84.50')

    expect(Number(result.data?.value)).toBe(16.9)
    expect(result.data?.steps).toEqual(expect.arrayContaining([expect.any(String)]))
    expect(result.summary).toMatch(/^20% of 84\.50 = /)
  })

  it('converts units and currencies, naming the rates day', async () => {
    const miles = await value('5 km in miles')

    expect(miles.data?.kind).toBe('unit')
    expect(Number(miles.data?.value)).toBeCloseTo(3.106856, 5)

    const reais = await value('100 USD in BRL')

    expect(reais.data).toMatchObject({ kind: 'currency', unit: 'BRL', ratesDate: '2026-10-15' })
    expect(Number(reais.data?.value)).toBeCloseTo(545.4545, 3)
    expect(reais.summary).toContain('ECB reference rates of 2026-10-15')

    const converted = await runCommand('calc.convert', { value: '5', from: 'km', to: 'mi' }, AGENT)

    expect(Number(converted.data?.value)).toBeCloseTo(3.106856, 5)
  })

  it('reads several lines as a note', async () => {
    const result = await value('budget = 1200\nbudget * 12')

    expect(Number(result.data?.value)).toBe(14400)
    expect(result.data?.lines).toHaveLength(2)
  })

  it('counts days to a date', async () => {
    const result = await value('days until Dec 25')

    expect(Number(result.data?.value)).toBe(70)
  })

  it('says where a function crosses zero without opening a window', async () => {
    const result = await runCommand('calc.plot', { expression: 'x^2 - 4', show: false }, AGENT)
    const zeros = (result.data?.functions as Array<{ zeros: number[] }> | undefined)?.[0]?.zeros ?? []

    expect(result.ok, result.error).toBe(true)
    expect(zeros).toHaveLength(2)
    expect(zeros[0]).toBeCloseTo(-2, 6)
    expect(zeros[1]).toBeCloseTo(2, 6)
    expect(edges.opened).toEqual([])
  })

  it('answers spoken math from the voice grammar', async () => {
    const percent = matchIntent("What's 15% of 340?")

    expect(percent).toMatchObject({ command: 'calc.eval', args: { text: '15% of 340' } })
    expect(Number((await value(String(percent?.args.text), VOICE)).data?.value)).toBe(51)

    const miles = matchIntent('how many miles is 10 km')

    expect(miles).toMatchObject({ command: 'calc.eval', args: { text: '10 km in miles' } })
    const distance = await value(String(miles?.args.text), VOICE)

    expect(Number(distance.data?.value)).toBeCloseTo(6.213712, 5)
    expect(distance.spoken).toMatch(/^10 km is 6\.21 miles$/)
    expect((await value('3 ft 4 in in cm', VOICE)).spoken).toMatch(/^3 ft 4 in is 101\.6 /)

    const tokyo = matchIntent('what time is it in tokyo')

    expect(tokyo).toMatchObject({ command: 'calc.eval', args: { text: 'time in tokyo' } })
    const time = await value(String(tokyo?.args.text), VOICE)

    expect(time.data).toMatchObject({ kind: 'time', zone: 'Asia/Tokyo' })
    expect(time.spoken).toMatch(/^It's .+ in Tokyo$/i)
    expect(time.spoken).not.toMatch(/in Tokyo.* in Tokyo/i)
  })
})
