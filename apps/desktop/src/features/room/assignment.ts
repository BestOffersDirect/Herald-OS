import { useStore } from '@nanostores/react'
import { useMemo, useRef } from 'react'
import { petShown } from '../../../shared/pet.ts'
import { surface } from '../../store/shell.ts'
import { $petPrefs } from '../pet/actions.ts'
import { $petInfo } from '../pet/info.ts'
import { assignPets, type PetAssignment } from '../petdex/assign.ts'
import { spriteCache } from '../petdex/cache.ts'
import type { RoomAgent } from './model/types.ts'
import { $roomPrefs } from './prefs.ts'

/** Each agent's pet and tint, kept steady while others come and go. */
export function useRoomAssignment(agents: readonly RoomAgent[]): Record<string, PetAssignment> {
  const prefs = useStore($roomPrefs)
  const info = useStore($petInfo)
  const petPrefs = useStore($petPrefs)
  // In desktop mode the desktop pet draws from the same cache, so it keeps a sheet of its own there.
  const cap = surface === 'desktop' && petShown(info) && !petPrefs.hidden ? spriteCache.cap - 1 : spriteCache.cap
  const previous = useRef<Record<string, PetAssignment>>({})

  return useMemo(() => {
    const next = assignPets(agents, info.installed, prefs, previous.current, cap)
    previous.current = next

    return next
  }, [agents, info.installed, prefs, cap])
}
