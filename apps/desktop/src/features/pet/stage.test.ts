import { describe, expect, it } from 'vitest'
import type { WmWindow } from '../../../shared/ipc.ts'
import type { OSWindow } from '../../store/windows.ts'
import { overlaps } from './placement.ts'
import { APP_TITLES, extrasLayout, followRectDesktop, followRectPanels, spriteOffset, stageTarget, windowFor } from './stage.ts'

const area = { x: 0, y: 30, width: 1440, height: 790 }
const size = { width: 64, height: 69 }
const base = { area, size, spot: null, approval: false, follow: null, dodge: null, obstacles: [] }

function win(id: string, appId: OSWindow['appId'], title: string, z: number, bounds = { x: 200, y: 200, width: 800, height: 500 }, phase: OSWindow['phase'] = 'open'): OSWindow {
  return { id, appId, title, bounds, z, phase, maximized: false }
}

describe('where the pet stands', () => {
  it('goes to the approval corner before anything else', () => {
    const target = stageTarget({ ...base, approval: true, follow: { x: 100, y: 300, width: 400, height: 300 }, spot: { x: 0, y: 0 } })

    expect(target.why).toBe('approval')
    expect(target.point.x + size.width).toBeGreaterThan(area.width - 60)
    expect(target.point.y + size.height).toBeGreaterThan(area.y + area.height - 60)
  })

  it('perches by the window Hermes works in, then a dodge, then its own spot', () => {
    const follow = { x: 100, y: 300, width: 400, height: 300 }

    expect(stageTarget({ ...base, follow, dodge: { x: 10, y: 400 } }).why).toBe('follow')
    expect(stageTarget({ ...base, dodge: { x: 10, y: 400 } })).toMatchObject({ why: 'dodge', point: { x: 10, y: 400 } })
    expect(stageTarget({ ...base, spot: { x: 0, y: 0 } })).toMatchObject({ why: 'home', point: { x: 0, y: 30 } })
  })

  it('keeps clear of the focused text field, except in the approval corner', () => {
    const home = stageTarget(base).point
    const field = { x: home.x - 20, y: home.y - 20, width: size.width + 40, height: size.height + 40 }
    const moved = stageTarget({ ...base, obstacles: [field] })

    expect(overlaps({ ...moved.point, ...size }, field)).toBe(false)
    expect(stageTarget({ ...base, approval: true, obstacles: [field] }).why).toBe('approval')
  })
})

describe('the bubble and the card beside the pet', () => {
  it('go above the pet with room, below it near the top, toward the middle of the screen', () => {
    expect(extrasLayout({ x: 1300, y: 700 }, size, area)).toEqual({ above: true, align: 'end' })
    expect(extrasLayout({ x: 20, y: 40 }, size, area)).toEqual({ above: false, align: 'start' })
  })

  it('put the panels-mode window around them, the pet where it stands', () => {
    const layout = { above: true, align: 'end' as const }
    const group = { width: 300, height: 69 + 8 + 200 }
    const placement = windowFor({ x: 1300, y: 700 }, size, group, layout, 10)
    const offset = spriteOffset(size, group, layout)

    expect(offset).toEqual({ x: 236, y: 208 })
    expect(placement).toEqual({ x: 1300 - 236 - 10, y: 700 - 208 - 10, width: 320, height: 297 })
    expect(windowFor({ x: 50, y: 60 }, size, size, { above: false, align: 'start' }, 10)).toEqual({ x: 40, y: 50, width: 84, height: 89 })
  })
})

describe('the window Hermes works in', () => {
  it('desktop: the window with the document, else the front one of the app, never a minimized one', () => {
    const windows = [win('a', 'docs', 'Herald Docs · Notes', 5), win('b', 'docs', 'Herald Docs · Q3 report', 2, { x: 10, y: 50, width: 600, height: 400 }), win('c', 'sheets', 'Herald Sheets', 9), win('d', 'docs', 'Herald Docs', 20, undefined, 'minimized')]

    expect(followRectDesktop(windows, { app: 'docs', document: 'Q3 report.docx', at: 0 })).toEqual({ x: 10, y: 50, width: 600, height: 400 })
    expect(followRectDesktop(windows, { app: 'docs', document: null, at: 0 })).toEqual({ x: 200, y: 200, width: 800, height: 500 })
    expect(followRectDesktop(windows, { app: 'canvas', document: null, at: 0 })).toBeNull()
  })

  it('panels: the app’s window on the workspace in front, where niri says it is', () => {
    const niri = (id: number, title: string, workspaceId: number, layout: WmWindow['layout']): WmWindow => ({ id, title, appId: 'herald-os', pid: 1, workspaceId, focused: false, floating: false, urgent: false, ours: true, layout })
    const output = { x: 0, y: 0, width: 1440, height: 900 }
    const tile = { width: 1000, height: 780, x: 20, y: 40, column: 2, tile: 1, tileWidth: 1004, tileHeight: 784 }
    const windows = [niri(1, 'Herald OS', 1, { ...tile, x: null, y: null, column: 1 }), niri(2, APP_TITLES.docs, 1, tile), niri(3, APP_TITLES.docs, 2, tile)]

    expect(followRectPanels(windows, 1, { app: 'docs', document: null, at: 0 }, output)).toMatchObject({ width: 1000, height: 780 })
    expect(followRectPanels(windows, 3, { app: 'docs', document: null, at: 0 }, output)).toBeNull()
    expect(followRectPanels(windows, 1, { app: 'slides', document: null, at: 0 }, output)).toBeNull()
  })

  it('panels: estimates a tile niri reports no place for inside the working area, under the menu bar', () => {
    const niri = (id: number, title: string, layout: WmWindow['layout']): WmWindow => ({ id, title, appId: 'herald-os', pid: 1, workspaceId: 1, focused: false, floating: false, urgent: false, ours: true, layout })
    const output = { x: 0, y: 0, width: 1440, height: 900 }
    const working = { x: 0, y: 30, width: 1440, height: 786 }
    const unplaced = { width: 700, height: 760, x: null, y: null, tileWidth: 704, tileHeight: 764 }
    const windows = [niri(1, 'Herald OS', { ...unplaced, column: 1, tile: 1 }), niri(2, APP_TITLES.sheets, { ...unplaced, column: 2, tile: 1 })]
    const rect = followRectPanels(windows, 1, { app: 'sheets', document: null, at: 0 }, output, working)

    expect(rect).not.toBeNull()
    expect(rect!.y).toBe(working.y + 10)
    expect(rect!.x).toBeGreaterThanOrEqual(working.x)
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(working.x + working.width)
  })
})
