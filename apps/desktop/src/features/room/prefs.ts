import { computed } from 'nanostores'
import { normalizeRoomPrefs, type RoomPrefs } from '../../../shared/room.ts'
import { $prefs, updatePrefs } from '../../store/backend.ts'

/** Herald's own Room preferences (prefs.json `room`). */
export const $roomPrefs = computed($prefs, prefs => normalizeRoomPrefs((prefs as { room?: unknown }).room))

export function setRoomPrefs(patch: Partial<RoomPrefs>): Promise<void> {
  const current = $roomPrefs.get()

  return updatePrefs({ room: { ...current, ...patch, pets: { ...current.pets, ...(patch.pets ?? {}) } } } as Parameters<typeof updatePrefs>[0])
}
