/*
 * CONTRACT STUB: the multi-pet worker replaces this body and keeps these exports and signatures.
 */

/** One timer for every animated pet in a window: each asks for its next tick and the clock wakes once for the earliest. */
export interface AnimationClock {
  /** Run `tick` once at `at` (a `Date.now()` time); scheduling the same key again replaces it. */
  schedule(key: string, at: number, tick: (now: number) => void): void
  cancel(key: string): void
  /** Nothing runs while paused; resuming runs what came due. */
  setPaused(paused: boolean): void
  /** Ticks waiting to run. */
  pending(): number
}

export const petClock: AnimationClock = {
  schedule: () => undefined,
  cancel: () => undefined,
  setPaused: () => undefined,
  pending: () => 0
}
