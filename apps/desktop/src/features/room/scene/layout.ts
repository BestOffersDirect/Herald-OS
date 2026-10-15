import { PET_FRAME_HEIGHT, PET_FRAME_WIDTH } from '../../../../shared/pet.ts'
import type { RoomAgent, RoomArea, RoomPhase } from '../model/types.ts'

/*
 * The Room's floor plan, for any window size: the Office and Canvas stations along the back wall,
 * the tool stations on the side walls, the waiting bench by the door to Hermes and the lounge at
 * the front. Every area is an entry in AREA_DEFS, so a new area (or a lane) is a row there.
 */

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Where a station stands; the front holds furniture pets sit on rather than a tile. */
export type Wall = 'back' | 'left' | 'right' | 'front'

export interface AreaDef {
  id: RoomArea
  /** On the station's tile. */
  label: string
  /** For tooltips and screen readers. */
  name: string
  wall: Wall
  /** Its share of its wall against the other stations there; at the front, its width in room units. */
  span: number
  /** Front furniture: how deep it is, in room units. */
  depth?: number
}

export const AREA_DEFS: readonly AreaDef[] = [
  { id: 'docs', label: 'Docs', name: 'Docs', wall: 'back', span: 1 },
  { id: 'sheets', label: 'Sheets', name: 'Sheets', wall: 'back', span: 1 },
  { id: 'slides', label: 'Slides', name: 'Slides', wall: 'back', span: 1 },
  { id: 'canvas', label: 'Canvas', name: 'Canvas', wall: 'back', span: 1 },
  { id: 'terminal', label: 'Terminal', name: 'Terminal', wall: 'left', span: 1 },
  { id: 'browser', label: 'Browser', name: 'Browser', wall: 'left', span: 1 },
  { id: 'files', label: 'Files', name: 'Files', wall: 'left', span: 1 },
  { id: 'studio', label: 'Studio', name: 'Studio', wall: 'right', span: 1 },
  { id: 'memory', label: 'Memory', name: 'Memory', wall: 'right', span: 1 },
  { id: 'messages', label: 'Messages', name: 'Messages and Connections', wall: 'right', span: 1 },
  { id: 'bench', label: 'Waiting bench', name: 'The waiting bench', wall: 'front', span: 3.3, depth: 0.62 },
  { id: 'lounge', label: 'Lounge', name: 'The lounge', wall: 'front', span: 3.6, depth: 0.85 }
]

export interface PetBox {
  width: number
  height: number
  /** Of a 192x208 sprite frame. */
  scale: number
}

/** Side by side, pets stand this many pet widths apart: a name tag is never wider, so neighbours' tags never meet. */
export const TAG_SPAN = 1.75

/** The widest a name tag or fact under a pet may be. */
export const tagWidth = (pet: PetBox): number => Math.round(pet.width * TAG_SPAN) - 8

/** A bubble's bottom sits this many pet heights over the pet's feet; it is about this many pixels tall. */
export const BUBBLE_RISE = 0.84
export const BUBBLE_HEIGHT = 24

/** The wall an area's station stands on. */
export const wallOf = (area: RoomArea, defs: readonly AreaDef[] = AREA_DEFS): Wall => defs.find(def => def.id === area)?.wall ?? 'front'

export interface Station {
  id: RoomArea
  label: string
  name: string
  wall: Wall
  /** The station's tile, or the bench or sofa at the front. */
  rect: Rect
  /** Where the first pet stands (its feet). */
  anchor: Point
  /** The way a row of pets runs; `both` grows it to either side of the anchor in turn, this way first. */
  along: Point
  both: boolean
  /** The way the next row goes when a row is full. */
  away: Point
  spacing: number
  rowStep: number
  perRow: number
  /** How far forward every other place in a row stands, so neighbours' name tags do not meet. */
  stagger: number
}

export interface SceneLayout {
  width: number
  height: number
  unit: number
  pet: PetBox
  /** The back wall band. */
  wall: Rect
  /** Where a pet's feet may be. */
  floor: Rect
  /** The door to Hermes, and the spot just inside it where pets come in and leave. */
  door: Rect
  doorway: Point
  stations: Station[]
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

const round = (value: number): number => Math.round(value)

/** Lengths `weights` share of `length`, with `gap` between them; each at most `most`, centred in its share. */
function spread(start: number, length: number, weights: readonly number[], gap: number, most: number): { start: number; length: number }[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1
  let cursor = start

  return weights.map(weight => {
    const share = (length * weight) / total
    const size = Math.max(0, Math.min(most * weight, share - gap))
    const placed = { start: round(cursor + (share - size) / 2), length: round(size) }
    cursor += share

    return placed
  })
}

/** The floor plan for a scene of `width` x `height` CSS pixels. */
export function layoutRoom(width: number, height: number, defs: readonly AreaDef[] = AREA_DEFS): SceneLayout {
  const w = Math.max(320, Number.isFinite(width) ? width : 0)
  const h = Math.max(240, Number.isFinite(height) ? height : 0)
  const unit = clamp(Math.min(w / 12, h / 8), 40, 84)
  const petHeight = round(clamp(unit, 46, 88))
  const scale = petHeight / PET_FRAME_HEIGHT
  const pet: PetBox = { width: round(PET_FRAME_WIDTH * scale), height: petHeight, scale }
  const pad = round(unit * 0.28)
  const gap = round(unit * 0.3)
  const tileHeight = round(unit * 0.95)
  const wallHeight = round(unit * 1.75)
  const sideWidth = round(unit * 1.75)
  const bottom = h - pad
  const door: Rect = { x: pad, y: bottom - round(unit * 1.7), width: round(unit * 0.95), height: round(unit * 1.7) }
  const doorway: Point = { x: round(door.x + door.width + pet.width * 0.32), y: bottom - 4 }
  const frontTop = bottom - round(unit * 1.45)
  const floor: Rect = { x: pad, y: wallHeight + round(pet.height * 0.3), width: w - pad * 2, height: bottom - wallHeight - round(pet.height * 0.3) }
  const stations: Station[] = []
  const on = (wall: Wall) => defs.filter(def => def.wall === wall)
  const inward = (rect: Rect): Point => ({ x: rect.x + rect.width / 2 <= w / 2 ? 1 : -1, y: 0 })
  const spacing = round(pet.width * TAG_SPAN)
  const rowStep = round(pet.height * 0.7)
  const stagger = round(pet.height * 0.12)

  const back = on('back')
  const innerStart = pad + sideWidth + gap + round(pet.width * 0.5)
  const backSlots = spread(innerStart, w - innerStart * 2, back.map(def => def.span), gap, round(unit * 2.4))
  // Back-wall pets queue forward into the room: a row along the wall would meet the next station's.
  back.forEach((def, index) => {
    const rect: Rect = { x: backSlots[index].start, y: wallHeight - round(pad * 0.5) - tileHeight, width: backSlots[index].length, height: tileHeight }
    stations.push({
      ...base(def),
      rect,
      anchor: { x: round(rect.x + rect.width / 2), y: round(rect.y + rect.height + Math.max(pet.height * 1.2, pet.height * BUBBLE_RISE + BUBBLE_HEIGHT + 4)) },
      along: inward(rect),
      both: true,
      away: { x: 0, y: 1 },
      spacing,
      rowStep,
      perRow: 1,
      stagger
    })
  })

  const sideTop = wallHeight + pad
  const sideBottom = frontTop - pad
  for (const wall of ['left', 'right'] as const) {
    const side = on(wall)
    const slots = spread(sideTop, sideBottom - sideTop, side.map(def => def.span), round(gap * 0.6), tileHeight)
    side.forEach((def, index) => {
      const x = wall === 'left' ? pad : w - pad - sideWidth
      const rect: Rect = { x, y: slots[index].start, width: sideWidth, height: Math.max(round(unit * 0.6), slots[index].length) }
      const direction = wall === 'left' ? 1 : -1
      const edge = wall === 'left' ? rect.x + rect.width : rect.x
      stations.push({
        ...base(def),
        rect,
        anchor: { x: round(edge + direction * pet.width * 0.62), y: round(rect.y + rect.height - pet.height * 0.04) },
        along: { x: direction, y: 0 },
        both: false,
        away: { x: 0, y: 1 },
        spacing,
        rowStep,
        perRow: 3,
        stagger
      })
    })
  }

  const front = on('front')
  const frontStart = door.x + door.width + pad
  const furniture = front.map(def => ({ def, width: round(unit * def.span), height: round(unit * (def.depth ?? 0.7)) }))
  const used = furniture.reduce((sum, item) => sum + item.width, 0)
  const room = w - pad - frontStart
  const squeeze = used > room ? room / used : 1
  const between = furniture.length > 1 ? Math.max(0, room - used * squeeze) / (furniture.length - 1) : 0
  let cursor = frontStart
  furniture.forEach(({ def, width: itemWidth, height: itemHeight }) => {
    const itemW = round(itemWidth * squeeze)
    const rect: Rect = { x: round(cursor), y: bottom - 8 - itemHeight, width: itemW, height: itemHeight }
    cursor += itemW + between
    stations.push({
      ...base(def),
      rect,
      anchor: { x: round(rect.x + rect.width / 2), y: round(rect.y + rect.height * 0.6) },
      along: inward(rect),
      both: true,
      away: { x: 0, y: -1 },
      spacing,
      rowStep,
      perRow: clamp(1 + 2 * Math.floor((rect.width / 2 + pet.width * 0.2) / spacing), 1, 5),
      stagger
    })
  })

  return { width: w, height: h, unit, pet, wall: { x: 0, y: 0, width: w, height: wallHeight }, floor, door, doorway, stations }
}

function base(def: AreaDef): Pick<Station, 'id' | 'label' | 'name' | 'wall'> {
  return { id: def.id, label: def.label, name: def.name, wall: def.wall }
}

/** The station an area's pets stand at; an area without one of its own uses the lounge, else the first. */
export function stationOf(layout: SceneLayout, area: RoomArea): Station {
  return layout.stations.find(station => station.id === area) ?? layout.stations.find(station => station.id === 'lounge') ?? layout.stations[0]
}

/** Offsets along a row: the anchor first, then either side in turn starting the `along` way (or that way only). */
const offsetAt = (index: number, both: boolean): number => (both ? (index % 2 === 1 ? (index + 1) / 2 : -index / 2) : index)

/** How many rows fit between a station's first place and the floor's edge, the way its rows go. */
function rowsThatFit(station: Station, floor: Rect): number {
  const { anchor, away, rowStep } = station
  const room = away.y > 0 ? floor.y + floor.height - anchor.y : away.y < 0 ? anchor.y - floor.y : away.x > 0 ? floor.x + floor.width - anchor.x : anchor.x - floor.x

  return Math.max(1, Math.floor(Math.max(0, room) / Math.max(1, rowStep)) + 1)
}

/**
 * Where the pet in `slot` of `area` stands; past the first row the rows fan out, and once they reach
 * the floor's edge they start again in another column beside the first, kept on the floor.
 */
export function slotPoint(layout: SceneLayout, area: RoomArea, slot: number): Point {
  const station = stationOf(layout, area)
  const { floor, pet } = layout
  const index = Math.max(0, Math.floor(slot) || 0)
  const depth = rowsThatFit(station, floor)
  const line = Math.floor(index / station.perRow)
  const column = Math.floor(line / depth)
  const row = line % depth
  const place = offsetAt(index % station.perRow, station.both)
  const shift = column === 0 ? 0 : (station.both ? offsetAt(column, true) : column) * station.perRow
  const offset = place + shift + (row % 2 === 1 ? 0.5 : 0)
  const forward = Math.abs(place) % 2 === 1 ? station.stagger : 0
  const x = station.anchor.x + station.along.x * offset * station.spacing + station.away.x * row * station.rowStep
  const y = station.anchor.y + station.along.y * offset * station.spacing + station.away.y * row * station.rowStep + forward

  return {
    x: round(clamp(x, floor.x + pet.width / 2, floor.x + floor.width - pet.width / 2)),
    y: round(clamp(y, floor.y, floor.y + floor.height))
  }
}

export interface SlotRef {
  area: RoomArea
  slot: number
}

/**
 * A slot for every agent: one that stays in its area keeps its slot, a newcomer takes the lowest
 * free one there, in the order given (so the caller decides who comes first).
 */
export function assignSlots(agents: readonly { id: string; area: RoomArea }[], previous: Readonly<Record<string, SlotRef>>): Record<string, SlotRef> {
  const next: Record<string, SlotRef> = {}
  const taken = new Map<RoomArea, Set<number>>()
  const takenIn = (area: RoomArea): Set<number> => {
    let set = taken.get(area)

    if (!set) {
      set = new Set()
      taken.set(area, set)
    }

    return set
  }

  for (const agent of agents) {
    const before = previous[agent.id]

    if (before && before.area === agent.area && !takenIn(agent.area).has(before.slot)) {
      next[agent.id] = before
      takenIn(agent.area).add(before.slot)
    }
  }

  for (const agent of agents) {
    if (next[agent.id]) {
      continue
    }

    const used = takenIn(agent.area)
    let slot = 0

    while (used.has(slot)) {
      slot++
    }

    used.add(slot)
    next[agent.id] = { area: agent.area, slot }
  }

  return next
}

/** Back to front: further up the floor is further away; ties left to right, then by id. */
export function depthOrder<T extends { id: string; x: number; y: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** How busy a phase is, for which pets show when there are more agents than the Room draws. */
const BUSY: Record<RoomPhase, number> = { waiting: 0, tool: 1, thinking: 2, starting: 3, queued: 4, finished: 5, idle: 6 }

/** About this many pets fit the room; the rest are a '+N more' chip. */
export const MAX_PETS = 24

/**
 * The busiest `max` agents (waiting on the person first, then working, then the rest); among equals
 * the ones already shown stay, then the most recently heard from. Returned oldest first, which is
 * the order newcomers take slots in.
 */
export function pickShown(agents: readonly RoomAgent[], max: number, shownBefore: ReadonlySet<string>): { shown: RoomAgent[]; more: number } {
  const ranked = [...agents].sort(
    (a, b) =>
      busyOf(a) - busyOf(b) ||
      Number(shownBefore.has(b.id)) - Number(shownBefore.has(a.id)) ||
      b.lastEventAt - a.lastEventAt ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
  const shown = ranked.slice(0, Math.max(0, max)).sort((a, b) => (a.startedAt ?? a.lastEventAt) - (b.startedAt ?? b.lastEventAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  return { shown, more: Math.max(0, agents.length - shown.length) }
}

const busyOf = (agent: RoomAgent): number => (agent.approval || agent.asking ? 0 : BUSY[agent.phase])
