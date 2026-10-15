import type { PetPose } from '../pet/sprite.ts'

/*
 * CONTRACT STUB: the multi-pet worker replaces this file and keeps the export and its props.
 */

/** A light pet view: one installed pet in a small canvas, from the shared sprite cache and clock (Settings' previews). */
export function PetFigure({ slug, pose = 'idle', scale = 0.4, tint = null, still = false, className }: { slug: string; pose?: PetPose; scale?: number; tint?: number | null; still?: boolean; className?: string }) {
  void slug
  void pose
  void scale
  void tint
  void still
  void className

  return null
}
