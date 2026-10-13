import type { PetFollow, PetFollowApp, PetRect, PetWindowPlacement } from '../../../shared/pet.ts'
import type { WmWindow } from '../../../shared/ipc.ts'
import type { OSWindow } from '../../store/windows.ts'
import { approvalPoint, avoid, clampPoint, followPoint, type Point, pointFromSpot, type Size, windowRect } from './placement.ts'

/*
 * Where the pet stands, in the order that wins: holding an approval in its corner, by the window
 * Hermes works in, stepped aside from the cursor, or at the spot the person left it; anything but the
 * approval corner keeps clear of the focused text field. Shared by the desktop overlay and the pet's
 * own window in panels mode.
 */

export type StageWhy = 'approval' | 'follow' | 'dodge' | 'home'

export interface StageInput {
  area: PetRect
  size: Size
  spot: { x: number; y: number } | null
  approval: boolean
  follow: PetRect | null
  dodge: Point | null
  obstacles: readonly PetRect[]
}

export function stageTarget(input: StageInput): { point: Point; why: StageWhy } {
  const { area, size, obstacles } = input
  const clear = (point: Point) => avoid(point, size, area, [...obstacles])

  if (input.approval) {
    return { point: approvalPoint(size, area), why: 'approval' }
  }

  if (input.follow) {
    return { point: clear(followPoint(input.follow, size, area)), why: 'follow' }
  }

  if (input.dodge) {
    return { point: clear(clampPoint(input.dodge, size, area)), why: 'dodge' }
  }

  return { point: clear(pointFromSpot(input.spot, size, area)), why: 'home' }
}

export interface ExtrasLayout {
  /** The bubble or card goes above the pet (below it near the top of the screen). */
  above: boolean
  /** Lined up on the pet's right edge (it is in the right half) or its left edge. */
  align: 'start' | 'end'
}

/** Room the bubble or the card needs above the pet. */
const EXTRAS_HEIGHT = 300

export function extrasLayout(point: Point, size: Size, area: PetRect): ExtrasLayout {
  const room = point.y - area.y

  return { above: room >= EXTRAS_HEIGHT || room >= area.y + area.height - (point.y + size.height), align: point.x + size.width / 2 > area.x + area.width / 2 ? 'end' : 'start' }
}

/** The pet's place inside its group (the sprite with the bubble or card beside it). */
export function spriteOffset(sprite: Size, group: Size, layout: ExtrasLayout): Point {
  return { x: layout.align === 'end' ? Math.max(0, group.width - sprite.width) : 0, y: layout.above ? Math.max(0, group.height - sprite.height) : 0 }
}

/** Panels mode: the pet window around the group, so the sprite lands on `point`; `pad` leaves room for shadows. */
export function windowFor(point: Point, sprite: Size, group: Size, layout: ExtrasLayout, pad: number): PetWindowPlacement {
  const offset = spriteOffset(sprite, group, layout)

  return { x: Math.round(point.x - offset.x - pad), y: Math.round(point.y - offset.y - pad), width: Math.ceil(Math.max(group.width, sprite.width) + pad * 2), height: Math.ceil(Math.max(group.height, sprite.height) + pad * 2) }
}

const sameDocument = (title: string, document: string | null): boolean => {
  if (!document) {
    return false
  }

  const stem = document.replace(/\.[a-z0-9]{1,5}$/i, '').toLowerCase()

  return Boolean(stem) && title.toLowerCase().includes(stem)
}

/** Desktop mode: the Herald window Hermes works in, from the window manager's own bounds. */
export function followRectDesktop(windows: readonly OSWindow[], follow: PetFollow): PetRect | null {
  const open = windows.filter(win => win.appId === follow.app && (win.phase === 'open' || win.phase === 'opening'))
  const win = open.find(candidate => sameDocument(candidate.title, follow.document)) ?? [...open].sort((a, b) => b.z - a.z)[0]

  return win ? { ...win.bounds } : null
}

/** The titles niri knows Herald's app windows by (electron/shell/mode.ts). */
export const APP_TITLES: Record<PetFollowApp, string> = { docs: 'Herald OS · Docs', sheets: 'Herald OS · Sheets', slides: 'Herald OS · Slides', canvas: 'Herald OS · Canvas' }

/**
 * Panels mode: the app's window on the workspace in front. niri reports positions in the output's
 * view; an estimate lays tiles out in the working area, below the menu bar's strut.
 */
export function followRectPanels(windows: readonly WmWindow[], focusedWorkspaceId: number | null, follow: PetFollow, output: PetRect, working: PetRect = output): PetRect | null {
  const win = windows.find(candidate => candidate.ours && candidate.title === APP_TITLES[follow.app] && candidate.workspaceId === focusedWorkspaceId)

  if (!win) {
    return null
  }

  const reported = win.layout?.x != null && win.layout.y != null

  return windowRect(win, windows.filter(other => other.workspaceId === win.workspaceId), reported ? output : working)
}
