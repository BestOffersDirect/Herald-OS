import { petBridge } from '../pet/transport.ts'
import { decodeSheet, type LoadedSheet, releaseSheet } from './sheet.ts'

/*
 * Every pet a window draws comes from one cache of decoded spritesheets, held by reference: views
 * that show the same pet share one sheet, sheets nobody holds stay for reuse until room is needed,
 * and no more than `cap` are ever decoded at once.
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
  /** Load a pet's sheet or reuse the decoded one; holds a reference until `release`. Null when it cannot be read, or when every sheet in a full cache is held. */
  acquire(ref: PetSheetRef): Promise<CachedSheet | null>
  release(key: string): void
  /** The decoded sheet when it is in the cache, without loading it. */
  peek(key: string): CachedSheet | null
  /** The cached sheet a loaded sheet belongs to, while it is still in the cache. */
  find(sheet: LoadedSheet): CachedSheet | null
  /** Called soon after a sheet loses its last holder, when a view that got null may find room; returns the unsubscribe. */
  onRelease(listener: () => void): () => void
  /** The most sheets kept decoded at once. */
  readonly cap: number
}

export const SPRITE_CACHE_CAP = 4

export const sheetKey = (ref: Pick<PetSheetRef, 'slug' | 'revision'>): string => `${ref.slug}@${ref.revision}`

export interface SpriteCacheOptions {
  cap: number
  /** Read and decode a sheet; null when it cannot be read. */
  load: (ref: PetSheetRef) => Promise<{ sheet: LoadedSheet; image: CanvasImageSource } | null>
  /** Free what `load` made, once the sheet leaves the cache. */
  release: (cached: CachedSheet) => void
}

interface Entry {
  key: string
  slug: string
  refs: number
  cached: CachedSheet | null
  loading: Promise<CachedSheet | null> | null
  /** When it lost its last holder, in release order: the earliest goes first when room is needed. */
  released: number
}

export function createSpriteCache({ cap, load, release: dispose }: SpriteCacheOptions): SpriteCache {
  const limit = Math.max(1, Math.floor(cap) || 1)
  const entries = new Map<string, Entry>()
  const owners = new WeakMap<LoadedSheet, CachedSheet>()
  /** The revision each pet was last asked for: an older one leaves as soon as nobody holds it. */
  const latest = new Map<string, string>()
  const listeners = new Set<() => void>()
  let releases = 0
  let announcing = false

  const outdated = (entry: Entry): boolean => latest.get(entry.slug) !== entry.key

  function evict(entry: Entry): void {
    entries.delete(entry.key)

    if (entry.cached) {
      owners.delete(entry.cached.sheet)
      dispose(entry.cached)
    }
  }

  function makeRoom(): boolean {
    while (entries.size >= limit) {
      const idle = [...entries.values()].filter(entry => entry.refs === 0 && entry.cached)

      if (!idle.length) {
        return false
      }

      evict(idle.reduce((oldest, entry) => (entry.released < oldest.released ? entry : oldest)))
    }

    return true
  }

  function announce(): void {
    if (announcing || !listeners.size) {
      return
    }

    announcing = true
    queueMicrotask(() => {
      announcing = false

      for (const listener of [...listeners]) {
        listener()
      }
    })
  }

  async function fill(entry: Entry, ref: PetSheetRef): Promise<CachedSheet | null> {
    let decoded: Awaited<ReturnType<SpriteCacheOptions['load']>> = null

    try {
      decoded = await load(ref)
    } catch {
      decoded = null
    }

    if (!decoded) {
      entries.delete(entry.key)

      return null
    }

    const cached: CachedSheet = { key: entry.key, slug: entry.slug, sheet: decoded.sheet, image: decoded.image }
    entry.cached = cached
    entry.loading = null
    owners.set(cached.sheet, cached)

    if (entry.refs === 0 && outdated(entry)) {
      evict(entry)

      return null
    }

    return cached
  }

  return {
    cap: limit,
    acquire(ref) {
      const key = sheetKey(ref)
      latest.set(ref.slug, key)

      for (const entry of [...entries.values()]) {
        if (entry.slug === ref.slug && entry.key !== key && entry.refs === 0 && entry.cached) {
          evict(entry)
        }
      }

      let entry = entries.get(key)

      if (!entry) {
        if (!makeRoom()) {
          return Promise.resolve(null)
        }

        const created: Entry = { key, slug: ref.slug, refs: 0, cached: null, loading: null, released: 0 }
        entries.set(key, created)
        created.loading = fill(created, ref)
        entry = created
      }

      entry.refs++

      return entry.cached ? Promise.resolve(entry.cached) : (entry.loading ?? Promise.resolve(null))
    },
    release(key) {
      const entry = entries.get(key)

      if (!entry || entry.refs === 0) {
        return
      }

      entry.refs--

      if (entry.refs > 0) {
        return
      }

      entry.released = ++releases

      if (entry.cached && outdated(entry)) {
        evict(entry)
      }

      announce()
    },
    peek: key => entries.get(key)?.cached ?? null,
    find: sheet => owners.get(sheet) ?? null,
    onRelease(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    }
  }
}

async function loadPetSheet(ref: PetSheetRef): Promise<{ sheet: LoadedSheet; image: CanvasImageSource } | null> {
  const bytes = await petBridge()?.sheet(ref.slug)

  return bytes ? decodeSheet(bytes, ref.mime) : null
}

function disposePetSheet(cached: CachedSheet): void {
  releaseSheet(cached.sheet)

  if (typeof ImageBitmap === 'function' && cached.image instanceof ImageBitmap) {
    cached.image.close()
  }
}

/** The renderer's decoded spritesheets, for the desktop pet, the Room and Settings' previews alike. */
export const spriteCache: SpriteCache = createSpriteCache({ cap: SPRITE_CACHE_CAP, load: loadPetSheet, release: disposePetSheet })
