import { computed } from 'nanostores'
import { mergeRoomPrefs, normalizeRoomPrefs, type RoomPrefsPatch } from '../../../shared/room.ts'
import { $prefs, updatePrefs } from '../../store/backend.ts'

/** Herald's own Room preferences (prefs.json `room`). */
export const $roomPrefs = computed($prefs, prefs => normalizeRoomPrefs(prefs.room))

/** Change the fields `patch` names; the pets change kind by kind. */
export function setRoomPrefs(patch: RoomPrefsPatch): Promise<void> {
  return updatePrefs({ room: mergeRoomPrefs($roomPrefs.get(), patch) })
}
