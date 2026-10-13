import { atom } from 'nanostores'
import { PET_OFF, type PetInfo, petShown } from '../../../shared/pet.ts'
import { type LoadedSheet, loadSheet, releaseSheet } from './sheet.ts'
import { petBridge } from './transport.ts'

/** The pet Hermes shows, as main reads it from Hermes's config.yaml and pets folder. */
export const $petInfo = atom<PetInfo>(PET_OFF)

/** The shown pet's spritesheet, decoded, in the windows that draw it. */
export const $petSheet = atom<LoadedSheet | null>(null)

let infoBound = false

export function bindPetInfo(): void {
  const bridge = petBridge()

  if (infoBound || !bridge) {
    return
  }

  infoBound = true
  void bridge
    .info()
    .then(info => $petInfo.set(info))
    .catch(() => undefined)
  bridge.onInfo(info => $petInfo.set(info))
}

/** Read Hermes's pet settings again now, after Herald asked Hermes to change them. */
export async function refreshPetInfo(): Promise<PetInfo> {
  const info = (await petBridge()?.refresh()) ?? $petInfo.get()
  $petInfo.set(info)

  return info
}

let sheetBound = false
let sheetKey = ''
let ticket = 0

function setSheet(next: LoadedSheet | null): void {
  const previous = $petSheet.get()
  $petSheet.set(next)

  if (previous && previous !== next) {
    releaseSheet(previous)
  }
}

/** Keep the shown pet's sheet loaded, once per spritesheet revision. */
export function bindPetSheet(): void {
  if (sheetBound) {
    return
  }

  sheetBound = true
  $petInfo.subscribe(info => {
    const key = petShown(info) ? `${info.slug}@${info.revision}` : ''

    if (key === sheetKey) {
      return
    }

    sheetKey = key
    const mine = ++ticket

    if (!key || !info.slug) {
      setSheet(null)

      return
    }

    void (async () => {
      const bytes = await petBridge()?.sheet(info.slug!)
      const sheet = bytes ? await loadSheet(bytes, info.mime ?? 'image/webp') : null

      if (mine === ticket) {
        setSheet(sheet)
      } else {
        releaseSheet(sheet)
      }
    })().catch(() => {
      if (mine === ticket) {
        setSheet(null)
      }
    })
  })
}
