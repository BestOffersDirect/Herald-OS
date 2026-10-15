import { describe, expect, it, vi } from 'vitest'
import { type CachedSheet, createSpriteCache, type PetSheetRef, SPRITE_CACHE_CAP, sheetKey, spriteCache } from './cache.ts'
import type { LoadedSheet } from './sheet.ts'

// The default loader reads through the preload bridge, which the shell store looks for when it loads.
vi.hoisted(() => {
  Object.assign(globalThis, { window: {} })
})

const ref = (slug: string, revision = '1'): PetSheetRef => ({ slug, revision, mime: 'image/webp' })

const sheetFor = (key: string): LoadedSheet => ({ url: `blob:${key}`, width: 1536, height: 1872, layout: { columns: 8, rows: 9, rowNames: [], frames: [] } })

/** A cache over a fake loader: `held` loads wait for `finish`, `broken` ones read as nothing, `throws` ones fail. */
function harness(cap = 4) {
  const loads: string[] = []
  const disposed: string[] = []
  const waiting = new Map<string, () => void>()
  const broken = new Set<string>()
  const throws = new Set<string>()
  const held = new Set<string>()
  const cache = createSpriteCache({
    cap,
    load: async next => {
      const key = sheetKey(next)
      loads.push(key)

      if (held.has(key)) {
        await new Promise<void>(resolve => waiting.set(key, resolve))
      }

      if (throws.has(key)) {
        throw new Error('unreadable')
      }

      return broken.has(key) ? null : { sheet: sheetFor(key), image: { key } as unknown as CanvasImageSource }
    },
    release: cached => disposed.push(cached.key)
  })

  return {
    cache,
    loads,
    disposed,
    broken,
    throws,
    held,
    finish: async (key: string) => {
      waiting.get(key)?.()
      await Promise.resolve()
    }
  }
}

/** Acquire sheets that must load, in order. */
async function take(cache: ReturnType<typeof harness>['cache'], ...slugs: string[]): Promise<CachedSheet[]> {
  const sheets: CachedSheet[] = []

  for (const slug of slugs) {
    const cached = await cache.acquire(ref(slug))
    expect(cached).not.toBeNull()
    sheets.push(cached!)
  }

  return sheets
}

describe('the sprite cache', () => {
  it('keys a sheet by pet and revision, and holds four sheets in the renderer', () => {
    expect(sheetKey({ slug: 'boba', revision: '17:2048' })).toBe('boba@17:2048')
    expect(SPRITE_CACHE_CAP).toBe(4)
    expect(spriteCache.cap).toBe(SPRITE_CACHE_CAP)
  })

  it('loads a sheet once and shares it between its holders, even while it is still loading', async () => {
    const { cache, loads, disposed, held, finish } = harness()
    held.add('boba@1')

    const first = cache.acquire(ref('boba'))
    const second = cache.acquire(ref('boba'))
    expect(loads).toEqual(['boba@1'])
    expect(cache.peek('boba@1')).toBeNull()

    await finish('boba@1')
    const [a, b] = await Promise.all([first, second])

    expect(a).toBe(b)
    expect(a).toMatchObject({ key: 'boba@1', slug: 'boba', sheet: { url: 'blob:boba@1' } })
    expect(cache.peek('boba@1')).toBe(a)

    cache.release('boba@1')
    cache.release('boba@1')
    expect(cache.peek('boba@1')).toBe(a)
    expect(disposed).toEqual([])

    expect(await cache.acquire(ref('boba'))).toBe(a)
    expect(loads).toEqual(['boba@1'])
  })

  it('finds the cached sheet a loaded sheet belongs to, until it leaves the cache', async () => {
    const { cache } = harness(1)
    const [boba] = await take(cache, 'boba')

    expect(cache.find(boba.sheet)).toBe(boba)
    expect(cache.find(sheetFor('boba@1'))).toBeNull()

    cache.release(boba.key)
    await take(cache, 'mochi')

    expect(cache.find(boba.sheet)).toBeNull()
    expect(cache.peek(boba.key)).toBeNull()
  })

  it('never decodes more than its cap: a new sheet while every one is held gets null without loading', async () => {
    const { cache, loads, disposed } = harness(2)
    await take(cache, 'a', 'b')

    expect(await cache.acquire(ref('c'))).toBeNull()
    expect(loads).toEqual(['a@1', 'b@1'])

    cache.release('a@1')
    expect(await cache.acquire(ref('c'))).toMatchObject({ key: 'c@1' })
    expect(disposed).toEqual(['a@1'])
    expect(loads).toEqual(['a@1', 'b@1', 'c@1'])
  })

  it('counts sheets still loading toward the cap', async () => {
    const { cache, loads, held, finish } = harness(1)
    held.add('a@1')
    const pending = cache.acquire(ref('a'))

    expect(await cache.acquire(ref('b'))).toBeNull()
    expect(loads).toEqual(['a@1'])

    await finish('a@1')
    expect(await pending).toMatchObject({ key: 'a@1' })
  })

  it('makes room by evicting the sheet let go longest ago, and never one that is held', async () => {
    const { cache, disposed } = harness(3)
    await take(cache, 'a', 'b', 'c')
    cache.release('b@1')
    cache.release('a@1')
    cache.release('c@1')

    await take(cache, 'd')
    expect(disposed).toEqual(['b@1'])
    await take(cache, 'e')
    expect(disposed).toEqual(['b@1', 'a@1'])

    expect(await cache.acquire(ref('c'))).toMatchObject({ key: 'c@1' })
    cache.release('d@1')
    await take(cache, 'f')
    expect(disposed).toEqual(['b@1', 'a@1', 'd@1'])
    expect(cache.peek('c@1')).not.toBeNull()
  })

  it('replaces an old revision of a pet as soon as nobody holds it', async () => {
    const { cache, disposed } = harness()
    const old = await cache.acquire(ref('boba', '1'))
    const next = await cache.acquire(ref('boba', '2'))

    expect(old).not.toBe(next)
    expect(cache.peek('boba@1')).toBe(old)

    cache.release('boba@1')
    expect(disposed).toEqual(['boba@1'])
    expect(cache.peek('boba@1')).toBeNull()

    await take(cache, 'mochi')
    cache.release('mochi@1')
    expect(cache.peek('mochi@1')).not.toBeNull()

    await cache.acquire(ref('mochi', '2'))
    expect(disposed).toEqual(['boba@1', 'mochi@1'])
  })

  it('ignores a release of a key it does not hold, and never counts below none', async () => {
    const { cache, disposed } = harness(1)
    cache.release('ghost@1')

    await take(cache, 'a')
    cache.release('a@1')
    cache.release('a@1')
    await take(cache, 'a')

    expect(await cache.acquire(ref('b'))).toBeNull()
    expect(disposed).toEqual([])
  })

  it('gives null for a sheet it cannot read, keeps nothing of it, and reads it again next time', async () => {
    const { cache, loads, disposed, broken, throws } = harness()
    broken.add('torn@1')
    throws.add('bad@1')

    expect(await cache.acquire(ref('torn'))).toBeNull()
    expect(await cache.acquire(ref('bad'))).toBeNull()
    expect(cache.peek('torn@1')).toBeNull()

    broken.clear()
    expect(await cache.acquire(ref('torn'))).toMatchObject({ key: 'torn@1' })
    expect(loads).toEqual(['torn@1', 'bad@1', 'torn@1'])
    expect(disposed).toEqual([])
  })

  it('drops a sheet that finished loading for nobody once a newer revision was asked for', async () => {
    const { cache, disposed, held, finish } = harness()
    held.add('boba@1')
    const old = cache.acquire(ref('boba', '1'))
    cache.release('boba@1')
    expect(await cache.acquire(ref('boba', '2'))).toMatchObject({ key: 'boba@2' })

    await finish('boba@1')
    expect(await old).toBeNull()
    expect(disposed).toEqual(['boba@1'])
  })

  it('tells its listeners soon after a sheet loses its last holder, once for several, and not for failed reads', async () => {
    const { cache, broken } = harness()
    const listener = vi.fn()
    const off = cache.onRelease(listener)
    await take(cache, 'a', 'b')

    cache.release('a@1')
    cache.release('b@1')
    expect(listener).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)

    broken.add('torn@1')
    await cache.acquire(ref('torn'))
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)

    off()
    await take(cache, 'a')
    cache.release('a@1')
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('lets a view that got null in a full cache try again once a sheet is let go', async () => {
    const { cache } = harness(1)
    await take(cache, 'a')
    expect(await cache.acquire(ref('b'))).toBeNull()

    const retried = new Promise<CachedSheet | null>(resolve => {
      const off = cache.onRelease(() => {
        off()
        resolve(cache.acquire(ref('b')))
      })
    })
    cache.release('a@1')

    expect(await retried).toMatchObject({ key: 'b@1' })
  })

  it('keeps at least one sheet whatever cap it is given', () => {
    expect(harness(0).cache.cap).toBe(1)
    expect(harness(Number.NaN).cache.cap).toBe(1)
    expect(harness(2.7).cache.cap).toBe(2)
  })
})
