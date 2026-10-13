import { describe, expect, it } from 'vitest'
import type { PetRect } from '../../../shared/pet.ts'
import { approvalPoint, avoid, bubblePlacement, clampPoint, cursorRect, followPoint, overlaps, PET_MARGIN, pointFromSpot, type Size, spotFromPoint, type TileLike, walkTo, windowRect } from './placement.ts'

const area: PetRect = { x: 0, y: 30, width: 1000, height: 600 }
const pet: Size = { width: 64, height: 69 }
const right = area.x + area.width - pet.width
const bottom = area.y + area.height - pet.height

describe('clampPoint', () => {
  it('keeps the pet whole inside the area', () => {
    expect(clampPoint({ x: 100, y: 100 }, pet, area)).toEqual({ x: 100, y: 100 })
    expect(clampPoint({ x: -50, y: 1000 }, pet, area)).toEqual({ x: 0, y: bottom })
    expect(clampPoint({ x: 2000, y: 0 }, pet, area)).toEqual({ x: right, y: 30 })
  })

  it('pins a pet bigger than the area to its top-left corner', () => {
    expect(clampPoint({ x: 50, y: 50 }, { width: 2000, height: 2000 }, area)).toEqual({ x: 0, y: 30 })
  })
})

describe('spots', () => {
  it('starts at home, 24 px in from the bottom-right corner', () => {
    expect(pointFromSpot(null, pet, area)).toEqual({ x: right - 24, y: bottom - 24 })
  })

  it('places a spot as fractions of the room the pet has', () => {
    expect(pointFromSpot({ x: 0, y: 0 }, pet, area)).toEqual({ x: 0, y: 30 })
    expect(pointFromSpot({ x: 1, y: 1 }, pet, area)).toEqual({ x: right, y: bottom })
    expect(pointFromSpot({ x: 0.5, y: 0.25 }, pet, area)).toEqual({ x: right / 2, y: 30 + (bottom - 30) / 4 })
    expect(pointFromSpot({ x: 4, y: -1 }, pet, area)).toEqual({ x: right, y: 30 })
  })

  it('round-trips between spots and points, on any area', () => {
    const wide: PetRect = { x: 200, y: 0, width: 1920, height: 1080 }

    for (const spot of [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0.5, y: 0.25 }, { x: 0.123, y: 0.987 }]) {
      const back = spotFromPoint(pointFromSpot(spot, pet, area), pet, area)

      expect(back.x).toBeCloseTo(spot.x, 10)
      expect(back.y).toBeCloseTo(spot.y, 10)
      expect(spotFromPoint(pointFromSpot(spot, pet, wide), pet, wide).x).toBeCloseTo(spot.x, 10)
    }

    const point = pointFromSpot(spotFromPoint({ x: 300, y: 200 }, pet, area), pet, area)

    expect(point.x).toBeCloseTo(300, 10)
    expect(point.y).toBeCloseTo(200, 10)
  })

  it('keeps a spot within 0 and 1, and at 0 when there is no room', () => {
    expect(spotFromPoint({ x: -100, y: 5000 }, pet, area)).toEqual({ x: 0, y: 1 })
    expect(spotFromPoint({ x: 10, y: 10 }, { width: 1000, height: 600 }, area)).toEqual({ x: 0, y: 0 })
  })
})

describe('approvalPoint', () => {
  it('is the bottom-right corner, 20 px in from the right and 16 from the bottom', () => {
    expect(approvalPoint(pet, area)).toEqual({ x: right - 20, y: bottom - 16 })
  })
})

describe('followPoint', () => {
  it('perches on the window’s top edge near its right end, feet 6 px over the edge', () => {
    expect(followPoint({ x: 200, y: 300, width: 500, height: 250 }, pet, area)).toEqual({ x: 700 - 64 - 16, y: 300 - 69 + 6 })
  })

  it('sits inside the window’s bottom-right corner when there is no room above it', () => {
    expect(followPoint({ x: 200, y: 40, width: 500, height: 400 }, pet, area)).toEqual({ x: 700 - 64 - 16, y: 440 - 69 - 16 })
  })

  it('stays in the area when the window reaches past it', () => {
    expect(followPoint({ x: 900, y: 300, width: 400, height: 200 }, pet, area)).toEqual({ x: right, y: 237 })
  })
})

describe('overlaps', () => {
  const a: PetRect = { x: 0, y: 0, width: 10, height: 10 }

  it('tells overlapping rectangles from touching ones', () => {
    expect(overlaps(a, { x: 9, y: 9, width: 10, height: 10 })).toBe(true)
    expect(overlaps(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false)
    expect(overlaps(a, { x: 0, y: -10, width: 10, height: 10 })).toBe(false)
  })

  it('counts rectangles closer than the margin as overlapping', () => {
    expect(overlaps(a, { x: 20, y: 0, width: 10, height: 10 }, 10)).toBe(false)
    expect(overlaps(a, { x: 20, y: 0, width: 10, height: 10 }, 11)).toBe(true)
  })
})

describe('avoid', () => {
  const start = { x: 500, y: 300 }

  it('stays put when nothing is in the way', () => {
    expect(avoid(start, pet, area, [{ x: 700, y: 300, width: 50, height: 50 }])).toEqual(start)
    expect(avoid(start, pet, area, [])).toEqual(start)
  })

  it('steps to the nearest free spot, sideways and to the left first on a tie', () => {
    const cursor = cursorRect({ x: 532, y: 334 })

    expect(avoid(start, pet, area, [cursor])).toEqual({ x: 420, y: 300 })
    expect(avoid(start, pet, area, [cursor])).toEqual(avoid(start, pet, area, [cursor]))
    expect(overlaps({ x: 420, y: 300, ...pet }, cursor, PET_MARGIN)).toBe(false)
  })

  it('moves up or down when that is nearer than going round', () => {
    const field = { x: 0, y: 280, width: 1000, height: 40 }

    expect(avoid(start, pet, area, [field])).toEqual({ x: 500, y: 348 })
  })

  it('looks only inside the area', () => {
    const corner = { x: right, y: bottom }

    expect(avoid(corner, pet, area, [{ x: 900, y: 500, width: 100, height: 130 }])).toEqual({ x: right - 128, y: bottom })
  })

  it('stays put when there is nowhere free', () => {
    expect(avoid(start, pet, area, [{ x: -100, y: -100, width: 2000, height: 2000 }])).toEqual(start)
  })
})

describe('cursorRect', () => {
  it('is a square around the cursor, 28 px each way unless told', () => {
    expect(cursorRect({ x: 100, y: 200 })).toEqual({ x: 72, y: 172, width: 56, height: 56 })
    expect(cursorRect({ x: 100, y: 200 }, 10)).toEqual({ x: 90, y: 190, width: 20, height: 20 })
  })
})

describe('walkTo', () => {
  it('walks at 180 px a second, facing the way it goes', () => {
    expect(walkTo({ x: 0, y: 0 }, { x: 180, y: 0 })).toEqual({ ms: 1000, dir: 1 })
    expect(walkTo({ x: 0, y: 0 }, { x: -90, y: 0 })).toEqual({ ms: 500, dir: -1 })
    expect(walkTo({ x: 0, y: 0 }, { x: 180, y: 0 }, 360)).toEqual({ ms: 500, dir: 1 })
  })

  it('faces forward for a move that is mostly up or down', () => {
    expect(walkTo({ x: 0, y: 0 }, { x: 3, y: 360 })).toEqual({ ms: 2000, dir: 0 })
    expect(walkTo({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ ms: 0, dir: 0 })
  })

  it('never takes longer than 2.6 seconds', () => {
    expect(walkTo({ x: 0, y: 0 }, { x: 2000, y: 0 })).toEqual({ ms: 2600, dir: 1 })
  })
})

describe('bubblePlacement', () => {
  const bubble = { width: 240, height: 120 }

  it('opens on the left of a pet in the right half, its bottom level with the pet’s top third', () => {
    expect(bubblePlacement({ x: 800, y: 400, ...pet }, bubble, area)).toEqual({ x: 800 - 8 - 240, y: 400 + 23 - 120 })
  })

  it('opens on the right of a pet in the left half', () => {
    expect(bubblePlacement({ x: 100, y: 400, ...pet }, bubble, area)).toEqual({ x: 100 + 64 + 8, y: 400 + 23 - 120 })
  })

  it('stays in the area', () => {
    expect(bubblePlacement({ x: 100, y: 40, ...pet }, bubble, area)).toEqual({ x: 172, y: 30 })
    expect(bubblePlacement({ x: 520, y: 400, ...pet }, { width: 600, height: 120 }, area)).toEqual({ x: 0, y: 303 })
  })
})

describe('windowRect', () => {
  const output: PetRect = { x: 0, y: 30, width: 1920, height: 966 }
  const tile = (id: number, column: number | null, extra: Partial<NonNullable<TileLike['layout']>> = {}, workspaceId = 1): TileLike => ({
    id,
    workspaceId,
    floating: column === null,
    layout: { width: 600, height: 800, x: null, y: null, column, tile: column === null ? null : 1, tileWidth: 600, tileHeight: 800, ...extra }
  })

  it('uses the place niri reports', () => {
    expect(windowRect(tile(1, 2, { x: 100, y: 40 }), [], output)).toEqual({ x: 100, y: 70, width: 600, height: 800 })
    expect(windowRect(tile(1, null, { x: 300, y: 200 }), [], output)).toEqual({ x: 300, y: 230, width: 600, height: 800 })
  })

  it('lays out the columns before a tile niri does not place, with the gaps between them', () => {
    const siblings = [tile(2, 1, { tileWidth: 600 }), tile(3, 2, { tileWidth: 500 }), tile(4, 2, { tileWidth: 520, tile: 2 }), tile(5, 4, { tileWidth: 700 })]

    expect(windowRect(tile(1, 3), siblings, output)).toEqual({ x: 10 + 610 + 530, y: 40, width: 600, height: 800 })
    expect(windowRect(tile(1, 3), siblings, output, 16)).toEqual({ x: 16 + 616 + 536, y: 46, width: 600, height: 800 })
  })

  it('counts only tiled windows on the same workspace', () => {
    const siblings = [tile(2, 1), tile(3, 1, { tileWidth: 900 }, 2), tile(4, null, { tileWidth: 900 })]

    expect(windowRect(tile(1, 2), siblings, output)).toEqual({ x: 620, y: 40, width: 600, height: 800 })
  })

  it('right-aligns a tile that would run past the area', () => {
    const siblings = [tile(2, 1, { tileWidth: 900 }), tile(3, 2, { tileWidth: 900 })]

    expect(windowRect(tile(1, 3, { width: 800 }), siblings, output)).toEqual({ x: 1920 - 10 - 800, y: 40, width: 800, height: 800 })
  })

  it('stacks a tile below the ones above it in its column', () => {
    const siblings = [tile(2, 1), tile(3, 2, { tileHeight: 400 })]

    expect(windowRect(tile(1, 2, { tile: 2, height: 400 }), siblings, output)).toEqual({ x: 620, y: 30 + 10 + 400 + 10, width: 600, height: 400 })
  })

  it('is null without a layout, or for a floating window niri does not place', () => {
    expect(windowRect({ id: 1, workspaceId: 1, floating: false }, [], output)).toBeNull()
    expect(windowRect({ id: 1, workspaceId: 1, floating: false, layout: null }, [], output)).toBeNull()
    expect(windowRect(tile(1, null), [], output)).toBeNull()
  })
})
