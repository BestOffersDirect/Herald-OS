import type { LoadedSheet } from '../pet/sheet.ts'

/*
 * CONTRACT STUB: the multi-pet worker replaces this body and keeps these exports and signatures.
 */

/** An installed pet's spritesheet as main serves it: by folder name, changing with its revision. */
export interface PetSheetRef {
  slug: string
  revision: string
  mime: 'image/png' | 'image/webp'
}

/** A decoded sheet in the renderer-wide cache. */
export interface CachedSheet {
  /** `slug@revision`. */
  key: string
  slug: string
  sheet: LoadedSheet
  /** Decoded and drawable. */
  image: CanvasImageSource
}

export interface SpriteCache {
  /** Load a pet's sheet or reuse the decoded one; holds a reference until `release`. Null when it cannot be read. */
  acquire(ref: PetSheetRef): Promise<CachedSheet | null>
  release(key: string): void
  /** The decoded sheet when it is in the cache, without loading it. */
  peek(key: string): CachedSheet | null
  /** The most sheets kept decoded at once. */
  readonly cap: number
}

export const SPRITE_CACHE_CAP = 4

export const sheetKey = (ref: Pick<PetSheetRef, 'slug' | 'revision'>): string => `${ref.slug}@${ref.revision}`

export const spriteCache: SpriteCache = {
  cap: SPRITE_CACHE_CAP,
  acquire: async () => null,
  release: () => undefined,
  peek: () => null
}
