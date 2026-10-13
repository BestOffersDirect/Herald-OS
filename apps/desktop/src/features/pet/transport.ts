import { atom } from 'nanostores'
import { PET_IDLE_SNAPSHOT, type PetAction, type PetBridge, type PetSnapshot } from '../../../shared/pet.ts'
import { isMainSurface, isPanels } from '../../store/shell.ts'

/*
 * How the pet and the Hermes window talk. The Hermes window works out what the pet shows, since it
 * holds the sessions and the approvals. In desktop mode the pet draws in that same window and reads
 * the atom; in panels mode main carries each snapshot to the pet's own window and its actions back.
 */

export const petBridge = (): PetBridge | null => (window.heraldOS as { pet?: PetBridge } | undefined)?.pet ?? null

/** What the pet shows now. */
export const $petSnapshot = atom<PetSnapshot>(PET_IDLE_SNAPSHOT)

/** The approval the desktop pet is holding up, which the request host then leaves to it. */
export const $petHeldApproval = atom<string | null>(null)

/** A request for the pet to open its chat bubble (`pet.chat`). */
export const $petChatRequest = atom(0)

type ActionHandler = (action: PetAction) => void

let handler: ActionHandler | null = null

/** The Hermes window takes the pet's actions: its own pet's directly, the pet window's through main. */
export function handlePetActions(next: ActionHandler): () => void {
  handler = next
  const off = isPanels ? petBridge()?.onAction(action => handler?.(action)) : undefined

  return () => {
    handler = null
    off?.()
  }
}

/** Ask the Hermes window to act on something the person did with the pet. */
export function petAct(action: PetAction): void {
  if (isMainSurface) {
    handler?.(action)

    return
  }

  petBridge()?.act(action)
}

export function publishPetSnapshot(snapshot: PetSnapshot): void {
  $petSnapshot.set(snapshot)

  if (isPanels) {
    petBridge()?.publish(snapshot)
  }
}

/** The pet window follows the snapshots main relays from the Hermes window. */
export function bindPetSnapshots(): () => void {
  return petBridge()?.onSnapshot(snapshot => $petSnapshot.set(snapshot)) ?? (() => {})
}
