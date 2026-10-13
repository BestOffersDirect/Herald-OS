import type { PetHideReason } from '../../../shared/pet.ts'
import type { Size } from './placement.ts'

export type PetHiddenWhy = 'off' | 'none' | 'hidden' | PetHideReason

export interface VisibilityInput {
  enabled: boolean
  installed: boolean
  hidden: boolean
  fullscreen: boolean
  presenting: boolean
  doNotDisturb: boolean
}

export function petHiddenWhy(input: VisibilityInput): PetHiddenWhy | null {
  if (!input.enabled) {
    return 'off'
  }

  if (!input.installed) {
    return 'none'
  }

  if (input.hidden) {
    return 'hidden'
  }

  return autoHideReason(input)
}

export function autoHideReason(input: { fullscreen: boolean; presenting: boolean; doNotDisturb: boolean }): PetHideReason | null {
  return input.presenting ? 'presenting' : input.fullscreen ? 'fullscreen' : input.doNotDisturb ? 'doNotDisturb' : null
}

export interface WindowLike {
  title: string
  workspaceId: number | null
  floating: boolean
  fullscreen?: boolean
  layout?: { width: number; height: number } | null
}

/** How far short of the output a tiled window may fall and still cover it (rounding of logical sizes). */
const COVER_SLACK = 2

export function fullscreenInFront(windows: readonly WindowLike[], focusedWorkspaceId: number | null, output: Size, ignoreTitles: readonly string[] = []): boolean {
  if (focusedWorkspaceId === null) {
    return false
  }

  return windows.some(win => {
    const size = win.layout

    if (win.workspaceId !== focusedWorkspaceId || ignoreTitles.includes(win.title)) {
      return false
    }

    return win.fullscreen === true || (!win.floating && !!size && size.width >= output.width - COVER_SLACK && size.height >= output.height - COVER_SLACK)
  })
}
