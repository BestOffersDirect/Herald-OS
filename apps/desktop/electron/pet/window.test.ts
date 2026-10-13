import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { WmState, WmWindow } from '../../shared/ipc.ts'
import { AUDIENCE_TITLE, bounceTarget, coverOf, Latest, PET_TITLE, petWorkArea, placementOf } from './window.ts'

vi.mock('electron', () => ({
  app: { on: () => undefined },
  BrowserWindow: { getAllWindows: () => [] },
  screen: { getPrimaryDisplay: () => ({ bounds: { x: 1920, y: 0, width: 2560, height: 1440 } }) }
}))

const win = (id: number, title: string): WmWindow => ({ id, title, appId: 'herald-os', pid: 1, workspaceId: 1, focused: false, floating: true, urgent: false, ours: true })

function state(focusedWindowId: number | null): WmState {
  return { available: true, windows: [win(1, 'Herald OS · Docs'), win(2, PET_TITLE)], workspaces: [], focusedWindowId }
}

describe('where the pet window goes', () => {
  it('takes whole pixels and a size between 1 and 2000', () => {
    expect(placementOf({ x: 1700.4, y: 851.6, width: 63.5, height: 68.6 })).toEqual({ x: 1700, y: 852, width: 64, height: 69 })
    expect(placementOf({ x: -12, y: 0, width: 0, height: 99999 })).toEqual({ x: -12, y: 0, width: 1, height: 2000 })
  })

  it('refuses anything that is not a placement', () => {
    expect(placementOf(null)).toBeNull()
    expect(placementOf({ x: 1, y: 2, width: 3 })).toBeNull()
    expect(placementOf({ x: '1', y: 2, width: 3, height: 4 })).toBeNull()
    expect(placementOf({ x: Number.NaN, y: 2, width: 3, height: 4 })).toBeNull()
    expect(placementOf({ x: 1, y: Number.POSITIVE_INFINITY, width: 3, height: 4 })).toBeNull()
  })

  it('moves in the whole output, from its top-left corner', () => {
    expect(petWorkArea()).toEqual({ x: 0, y: 0, width: 2560, height: 1440 })
  })
})

describe('what covers the pet', () => {
  it('is nothing while no Herald window is full screen', () => {
    expect(coverOf([])).toEqual({ fullscreen: false, presenting: false })
    expect(coverOf([{ title: 'Herald OS', fullscreen: false }, { title: 'Herald OS · Slides', fullscreen: false }])).toEqual({ fullscreen: false, presenting: false })
  })

  it('is a full screen window, the pet’s own left out', () => {
    expect(coverOf([{ title: 'Herald OS · Docs', fullscreen: true }])).toEqual({ fullscreen: true, presenting: false })
    expect(coverOf([{ title: PET_TITLE, fullscreen: true }])).toEqual({ fullscreen: false, presenting: false })
  })

  it('is presenting while Herald Slides is full screen or its audience window is open', () => {
    expect(coverOf([{ title: 'Herald OS · Slides', fullscreen: true }])).toEqual({ fullscreen: true, presenting: true })
    expect(coverOf([{ title: 'Herald OS · Slides', fullscreen: false }, { title: AUDIENCE_TITLE, fullscreen: false }])).toEqual({ fullscreen: false, presenting: true })
  })

  it('knows the audience window by the title Herald Slides gives it', () => {
    const presenter = fs.readFileSync(new URL('../office/presenter.ts', import.meta.url), 'utf8')

    expect(presenter).toContain(`const AUDIENCE_TITLE = '${AUDIENCE_TITLE}'`)
  })
})

describe('the keys and the pet', () => {
  it('gives them back when niri hands them to the pet while it takes none', () => {
    expect(bounceTarget(state(2), 2, false, 1)).toBe(1)
  })

  it('leaves them while its chat box is open, while another window has them, or with nowhere to go', () => {
    expect(bounceTarget(state(2), 2, true, 1)).toBeNull()
    expect(bounceTarget(state(1), 2, false, 1)).toBeNull()
    expect(bounceTarget(state(2), 2, false, null)).toBeNull()
    expect(bounceTarget(state(2), 2, false, 2)).toBeNull()
    expect(bounceTarget(state(2), null, false, 1)).toBeNull()
  })
})

describe('Latest', () => {
  it('runs one job at a time, keeps only the latest asked for meanwhile, and settles every push', async () => {
    const ran: number[] = []
    let finish: () => void = () => undefined
    const latest = new Latest<number>(async value => {
      ran.push(value)
      await new Promise<void>(resolve => {
        finish = () => resolve()
      })
    })

    const first = latest.push(1)
    const dropped = latest.push(2)
    const last = latest.push(3)
    expect(ran).toEqual([1])

    finish()
    await first
    await vi.waitFor(() => expect(ran).toEqual([1, 3]))
    finish()
    await Promise.all([dropped, last])
    expect(ran).toEqual([1, 3])
  })

  it('goes on after a job fails', async () => {
    const ran: number[] = []
    const latest = new Latest<number>(async value => {
      ran.push(value)

      if (value === 1) {
        throw new Error('niri is busy')
      }
    })

    await latest.push(1)
    await latest.push(2)
    expect(ran).toEqual([1, 2])
  })
})
