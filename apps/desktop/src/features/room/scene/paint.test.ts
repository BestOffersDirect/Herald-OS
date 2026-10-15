import { describe, expect, it, vi } from 'vitest'
import type { CachedSheet } from '../../petdex/cache.ts'
import type { RoomAgent } from '../model/types.ts'
import type { PetFrame } from './engine.ts'
import { layoutRoom } from './layout.ts'
import { FEET, paintPets, spriteRect } from './paint.ts'

const sheet = { key: 'boba@1', slug: 'boba', sheet: { url: '', width: 1, height: 1, layout: { columns: 1, rows: 1, rowNames: ['idle'], frames: [1] } }, image: {} } as unknown as CachedSheet

function frame(id: string, patch: Partial<PetFrame> = {}): PetFrame {
  return { id, agent: { id } as RoomAgent, x: 100, y: 200, opacity: 1, pose: 'idle', cell: { row: 0, frame: 2, mirror: false, nextAt: null }, sheet, tint: null, leaving: false, ...patch }
}

/** A 2D context that writes down what is asked of it. */
function recorder() {
  const calls: { name: string; args: unknown[]; alpha: number }[] = []
  const ctx: Record<string, unknown> = { globalAlpha: 1, fillStyle: '' }
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push({ name, args, alpha: ctx.globalAlpha as number })

      return name === 'createRadialGradient' ? { addColorStop: vi.fn() } : undefined
    }

  for (const name of ['setTransform', 'clearRect', 'createRadialGradient', 'save', 'restore', 'translate', 'scale', 'beginPath', 'arc', 'fill']) {
    ctx[name] = record(name)
  }

  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

describe('paintPets', () => {
  const layout = layoutRoom(1100, 620)

  it('scales to device pixels and clears the scene first', () => {
    const { ctx, calls } = recorder()
    paintPets(ctx, [], layout, 2, vi.fn())

    expect(calls[0]).toMatchObject({ name: 'setTransform', args: [2, 0, 0, 2, 0, 0] })
    expect(calls[1]).toMatchObject({ name: 'clearRect', args: [0, 0, layout.width, layout.height] })
  })

  it('draws each pet in the order given, on a shadow at its feet, with its cell and tint', () => {
    const { ctx, calls } = recorder()
    const draw = vi.fn()
    paintPets(ctx, [frame('back', { y: 150 }), frame('front', { y: 400, tint: 2, cell: { row: 1, frame: 3, mirror: true, nextAt: 5 } })], layout, 1, draw)

    expect(draw.mock.calls.map(call => call[2])).toEqual([
      { row: 0, frame: 2, mirror: false },
      { row: 1, frame: 3, mirror: true }
    ])
    expect(draw.mock.calls[1][3]).toEqual(spriteRect({ x: 100, y: 400 }, layout.pet))
    expect(draw.mock.calls[1][4]).toBe(2)
    expect(calls.filter(call => call.name === 'translate').map(call => call.args)).toEqual([
      [100, 150],
      [100, 400]
    ])
  })

  it('fades a pet as a whole, and skips one that is not visible at all', () => {
    const { ctx, calls } = recorder()
    const draw = vi.fn()
    paintPets(ctx, [frame('fading', { opacity: 0.25 }), frame('gone', { opacity: 0 })], layout, 1, draw)

    expect(draw).toHaveBeenCalledTimes(1)
    expect(calls.filter(call => call.name === 'fill').map(call => call.alpha)).toEqual([0.25])
  })

  it('draws only the shadow of a pet whose sheet is not in yet', () => {
    const { ctx, calls } = recorder()
    const draw = vi.fn()
    paintPets(ctx, [frame('waiting', { sheet: null, cell: null })], layout, 1, draw)

    expect(draw).not.toHaveBeenCalled()
    expect(calls.some(call => call.name === 'fill')).toBe(true)
  })

  it('stands a pet with its feet near the bottom of its frame', () => {
    const rect = spriteRect({ x: 100, y: 200 }, layout.pet)

    expect(rect.x + rect.width / 2).toBe(100)
    expect(rect.y + rect.height * FEET).toBeCloseTo(200)
  })
})
