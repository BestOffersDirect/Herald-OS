import type { InstalledPet } from '../../../shared/pet.ts'
import type { RoomKind, RoomPrefs } from '../../../shared/room.ts'

/*
 * CONTRACT STUB: the multi-pet worker replaces this body and keeps these exports and signatures.
 */

/** The pet an agent shows: an installed pet's folder name and a PET_TINTS index (null for its own colours). */
export interface PetAssignment {
  slug: string
  tint: number | null
}

/**
 * A pet for every agent: the person's choice for its kind of work, else one picked from the installed
 * pets; agents sharing a sprite get tints (when `prefs.tints` is on). `previous` keeps each agent's pet
 * and tint stable while others come and go; at most `cap` distinct sheets are used.
 */
export function assignPets(agents: readonly { id: string; kind: RoomKind }[], installed: readonly InstalledPet[], prefs: RoomPrefs, previous: Readonly<Record<string, PetAssignment>>, cap: number): Record<string, PetAssignment> {
  void prefs
  void previous
  void cap
  const first = installed[0]

  return first ? Object.fromEntries(agents.map(agent => [agent.id, { slug: first.slug, tint: null }])) : {}
}
