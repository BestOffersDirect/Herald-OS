/*
 * The Room: a window where every live piece of Hermes work in Herald's own backend stands as a
 * petdex pet. Shared by Electron main (prefs.json) and the renderer. Which pets are installed and
 * which one Hermes shows stay Hermes's (`display.pet`); the Room only borrows installed pets.
 */

/** The kinds of work a pet can stand for; automations arrive with phase 2 of the Room. */
export type RoomKind = 'conversation' | 'mission' | 'helper' | 'automation'
export const ROOM_KINDS: readonly RoomKind[] = ['conversation', 'mission', 'helper', 'automation']

/** How much the Room moves: walking and animated, animated in place, or still frames. */
export type RoomMotion = 'full' | 'calm' | 'still'
export const ROOM_MOTIONS: readonly RoomMotion[] = ['full', 'calm', 'still']

/** Herald's own Room preferences in prefs.json. */
export interface RoomPrefs {
  /** The installed pet (its folder name) for each kind of work; null picks one by itself. */
  pets: Record<RoomKind, string | null>
  /** Colour pets that share a sprite, so several agents of one kind tell apart. */
  tints: boolean
  motion: RoomMotion
  /** Bubbles say what each pet is doing; off leaves name tags, signs and facts. */
  steps: boolean
}

export const ROOM_PREFS_DEFAULTS: RoomPrefs = {
  pets: { conversation: null, mission: null, helper: null, automation: null },
  tints: true,
  motion: 'full',
  steps: true
}

/** A change to the Room preferences: only the fields it names change, and the pets kind by kind. */
export type RoomPrefsPatch = Partial<Omit<RoomPrefs, 'pets'>> & { pets?: Partial<Record<RoomKind, string | null>> }

/** A pet's folder name as prefs.json may hold it: one path segment, never a dot-folder. */
function slugOrNull(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const slug = value.trim()

  return slug && !/[\\/]/.test(slug) && !slug.startsWith('.') ? slug : null
}

/** A stored value made whole: unknown keys dropped, missing ones from the defaults. */
export function normalizeRoomPrefs(raw: unknown): RoomPrefs {
  const source = record(raw)
  const pets = record(source.pets)

  return {
    pets: Object.fromEntries(ROOM_KINDS.map(kind => [kind, slugOrNull(pets[kind])])) as Record<RoomKind, string | null>,
    tints: source.tints !== false,
    motion: ROOM_MOTIONS.includes(source.motion as RoomMotion) ? (source.motion as RoomMotion) : ROOM_PREFS_DEFAULTS.motion,
    steps: source.steps !== false
  }
}

/** `patch` over `current`, field by field and the pets kind by kind; a field left undefined keeps its value. */
export function mergeRoomPrefs(current: unknown, patch: unknown): RoomPrefs {
  const base = record(current)
  const change = defined(record(patch))

  return normalizeRoomPrefs({ ...base, ...change, pets: { ...record(base.pets), ...defined(record(change.pets)) } })
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function defined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
}
