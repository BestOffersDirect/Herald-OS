import type { CachedSheet } from './cache.ts'

/*
 * CONTRACT STUB: the multi-pet worker replaces this body and keeps these exports and signatures.
 */

/** Colour variants for pets that share a sprite: index 0 is the pet's own colours. */
export const PET_TINTS: readonly { hue: number; label: string }[] = [{ hue: 0, label: 'own colours' }]

export interface SpriteCell {
  row: number
  frame: number
  mirror: boolean
}

/** Draw one frame of a sheet into `dest` (CSS pixels of an already scaled context), tinted when `tint` is a PET_TINTS index above 0. */
export function drawPetFrame(ctx: CanvasRenderingContext2D, cached: CachedSheet, cell: SpriteCell, dest: { x: number; y: number; width: number; height: number }, tint: number | null): void {
  void ctx
  void cached
  void cell
  void dest
  void tint
}
