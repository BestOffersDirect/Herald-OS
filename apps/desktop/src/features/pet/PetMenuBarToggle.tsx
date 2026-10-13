import { useStore } from '@nanostores/react'
import { IconPaw, IconPawOff } from '@tabler/icons-react'
import { petShown } from '../../../shared/pet.ts'
import { cn } from '../../lib/cn.ts'
import { $petPrefs, petShortcutLabel, togglePet } from './actions.ts'
import { $petInfo } from './info.ts'

/** The menu bar's pet switch: put the pet away for a screen share, and bring it back. Only while a pet is on. */
export function PetMenuBarToggle() {
  const info = useStore($petInfo)
  const prefs = useStore($petPrefs)

  if (!petShown(info)) {
    return null
  }

  const label = prefs.hidden ? 'Show the pet' : 'Hide the pet'

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={prefs.hidden}
      title={`${label} (${petShortcutLabel()})`}
      onClick={() => void togglePet().catch(() => undefined)}
      className={cn('flex size-6 items-center justify-center rounded-md hover:bg-white/10', prefs.hidden && 'text-fg-3')}
    >
      {prefs.hidden ? <IconPawOff size={15} /> : <IconPaw size={15} />}
    </button>
  )
}
