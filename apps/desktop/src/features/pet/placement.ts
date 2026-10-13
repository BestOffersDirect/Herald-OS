import type { WmLayout } from '../../../shared/ipc.ts'
import type { PetRect } from '../../../shared/pet.ts'

/*
 * Where the pet stands, in the coordinates of the area it moves in: its home, the spot the person
 * left it at, the approval corner, the window it follows, and out of the way of the cursor and of
 * the field the person types in.
 */

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

/** The room the pet keeps around what it steps away from. */
export const PET_MARGIN = 16

const HOME_INSET = 24
const APPROVAL_INSET = { right: 20, bottom: 16 }
/** How far the pet's feet come down over the top edge of the window it perches on. */
const PERCH_OVERLAP = 6

export function clampPoint(point: Point, size: Size, area: PetRect): Point {
  const within = (value: number, start: number, length: number, extent: number): number => Math.min(Math.max(value, start), start + Math.max(0, length - extent))

  return { x: within(point.x, area.x, area.width, size.width), y: within(point.y, area.y, area.height, size.height) }
}

const fraction = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)

export function pointFromSpot(spot: { x: number; y: number } | null, size: Size, area: PetRect): Point {
  if (!spot) {
    return clampPoint({ x: area.x + area.width - size.width - HOME_INSET, y: area.y + area.height - size.height - HOME_INSET }, size, area)
  }

  return clampPoint({ x: area.x + fraction(spot.x) * Math.max(0, area.width - size.width), y: area.y + fraction(spot.y) * Math.max(0, area.height - size.height) }, size, area)
}

export function spotFromPoint(point: Point, size: Size, area: PetRect): { x: number; y: number } {
  const at = clampPoint(point, size, area)
  const share = (offset: number, room: number): number => (room > 0 ? fraction(offset / room) : 0)

  return { x: share(at.x - area.x, area.width - size.width), y: share(at.y - area.y, area.height - size.height) }
}

export function approvalPoint(size: Size, area: PetRect): Point {
  return clampPoint({ x: area.x + area.width - size.width - APPROVAL_INSET.right, y: area.y + area.height - size.height - APPROVAL_INSET.bottom }, size, area)
}

export function followPoint(target: PetRect, size: Size, area: PetRect): Point {
  const x = target.x + target.width - size.width - PET_MARGIN
  const perched = target.y - size.height + PERCH_OVERLAP

  return clampPoint({ x, y: perched >= area.y ? perched : target.y + target.height - size.height - PET_MARGIN }, size, area)
}

export function overlaps(a: PetRect, b: PetRect, margin = 0): boolean {
  return a.x < b.x + b.width + margin && b.x < a.x + a.width + margin && a.y < b.y + b.height + margin && b.y < a.y + a.height + margin
}

const AVOID_STEP = 16

/** Offsets in steps from `from` that reach both ends of [low, high], nearest first, back before ahead. */
function offsets(from: number, low: number, high: number): number[] {
  const back = Math.max(0, Math.ceil((from - low) / AVOID_STEP))
  const ahead = Math.max(0, Math.ceil((high - from) / AVOID_STEP))
  const list = [0]

  for (let step = 1; step <= Math.max(back, ahead); step++) {
    if (step <= back) {
      list.push(-step * AVOID_STEP)
    }

    if (step <= ahead) {
      list.push(step * AVOID_STEP)
    }
  }

  return list
}

export function avoid(point: Point, size: Size, area: PetRect, obstacles: PetRect[], margin = PET_MARGIN): Point {
  const start = clampPoint(point, size, area)
  const free = (at: Point): boolean => !obstacles.some(obstacle => overlaps({ ...at, ...size }, obstacle, margin))

  if (free(start)) {
    return start
  }

  const high = clampPoint({ x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY }, size, area)
  let best = start
  let bestDistance = Number.POSITIVE_INFINITY

  for (const dy of offsets(start.y, area.y, high.y)) {
    const y = clampPoint({ x: start.x, y: start.y + dy }, size, area).y

    if (Math.abs(y - start.y) >= bestDistance) {
      continue
    }

    for (const dx of offsets(start.x, area.x, high.x)) {
      const at = clampPoint({ x: start.x + dx, y }, size, area)
      const distance = Math.hypot(at.x - start.x, at.y - start.y)

      if (distance < bestDistance && free(at)) {
        best = at
        bestDistance = distance
      }
    }
  }

  return best
}

export function cursorRect(cursor: Point, radius = 28): PetRect {
  return { x: cursor.x - radius, y: cursor.y - radius, width: radius * 2, height: radius * 2 }
}

export interface Walk {
  ms: number
  dir: -1 | 0 | 1
}

const WALK_SPEED = 180
/** A far spot is reached quicker rather than walked to slowly across the screen. */
const LONGEST_WALK_MS = 2600

export function walkTo(from: Point, to: Point, speed = WALK_SPEED): Walk {
  const dx = to.x - from.x
  const ms = (Math.hypot(dx, to.y - from.y) / (speed > 0 ? speed : WALK_SPEED)) * 1000

  return { ms: Math.round(Math.min(LONGEST_WALK_MS, Math.max(0, ms || 0))), dir: Math.abs(dx) < 4 ? 0 : dx < 0 ? -1 : 1 }
}

const BUBBLE_GAP = 8

export function bubblePlacement(pet: PetRect, bubble: Size, area: PetRect): Point {
  const rightHalf = pet.x + pet.width / 2 > area.x + area.width / 2
  const x = rightHalf ? pet.x - BUBBLE_GAP - bubble.width : pet.x + pet.width + BUBBLE_GAP

  return clampPoint({ x, y: pet.y + pet.height / 3 - bubble.height }, bubble, area)
}

export interface TileLike {
  id: number
  workspaceId: number | null
  floating: boolean
  layout?: WmLayout | null
}

/** Herald's niri config sets `gaps 10` (linux/niri/config.kdl). */
const NIRI_GAP = 10

export function windowRect(win: TileLike, siblings: readonly TileLike[], area: PetRect, gap = NIRI_GAP): PetRect | null {
  const layout = win.layout

  if (!layout) {
    return null
  }

  if (layout.x !== null && layout.y !== null) {
    return { x: area.x + layout.x, y: area.y + layout.y, width: layout.width, height: layout.height }
  }

  if (win.floating) {
    return null
  }

  // An approximation: niri does not report where tiles are in the view (older versions, or a tile
  // scrolled out of it), so this lays the workspace's columns out from the area's left edge.
  const column = layout.column ?? 1
  const tile = layout.tile ?? 1
  const widths = new Map<number, number>()
  let y = area.y + gap

  for (const sibling of siblings) {
    const place = sibling.layout

    if (sibling.id === win.id || sibling.floating || win.workspaceId === null || sibling.workspaceId !== win.workspaceId || !place || place.column === null) {
      continue
    }

    if (place.column < column) {
      widths.set(place.column, Math.max(widths.get(place.column) ?? 0, place.tileWidth))
    } else if (place.column === column && place.tile !== null && place.tile < tile) {
      y += place.tileHeight + gap
    }
  }

  const x = [...widths.values()].reduce((left, width) => left + width + gap, area.x + gap)

  return { x: x + layout.width > area.x + area.width ? Math.max(area.x, area.x + area.width - gap - layout.width) : x, y, width: layout.width, height: layout.height }
}
