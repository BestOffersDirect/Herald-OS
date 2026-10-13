import { describe, expect, it } from 'vitest'
import { PET_FRAME_HEIGHT, PET_FRAME_WIDTH } from '../../../shared/pet.ts'
import { alphaIsBlank, CODEX_ROWS, FRAME_MS, frameAt, IDLE_LOOPS, LEGACY_ROWS, layoutFromBlanks, PERK_MS, poseFor, poseRow, rowNamesFor, type SheetLayout, WALK_FRAME_MS } from './sprite.ts'

/** A sheet whose row `n` has `counts[n]` frames before its first blank cell. */
const sheet = (columns: number, counts: number[]): SheetLayout => layoutFromBlanks(columns * PET_FRAME_WIDTH, counts.length * PET_FRAME_HEIGHT, (column, row) => column >= counts[row])

const codex = sheet(8, [6, 8, 8, 4, 5, 8, 6, 8, 7])
const legacy = sheet(9, [6, 4, 9, 7, 6, 5, 2, 2])

describe('rowNamesFor', () => {
  it('names nine rows or more as a Codex atlas and fewer as the legacy one', () => {
    expect(rowNamesFor(9)).toEqual([...CODEX_ROWS])
    expect(rowNamesFor(8)).toEqual([...LEGACY_ROWS])
    expect(rowNamesFor(4)).toEqual(['idle', 'wave', 'run', 'failed'])
    expect(rowNamesFor(10)).toEqual([...CODEX_ROWS, 'row9'])
    expect(rowNamesFor(0)).toEqual([])
  })
})

describe('layoutFromBlanks', () => {
  it('reads a Codex sheet: eight columns, nine rows, each up to its first blank frame', () => {
    expect(codex).toEqual({ columns: 8, rows: 9, rowNames: [...CODEX_ROWS], frames: [6, 8, 8, 4, 5, 8, 6, 8, 7] })
  })

  it('reads a legacy sheet: nine columns, eight rows', () => {
    expect(legacy).toEqual({ columns: 9, rows: 8, rowNames: [...LEGACY_ROWS], frames: [6, 4, 9, 7, 6, 5, 2, 2] })
  })

  it('stops a row at its first blank frame, even with drawn frames after it, and keeps at least one', () => {
    const gaps = layoutFromBlanks(8 * PET_FRAME_WIDTH, 9 * PET_FRAME_HEIGHT, (column, row) => (row === 0 ? column === 3 : row === 1))

    expect(gaps.frames.slice(0, 3)).toEqual([3, 1, 8])
  })

  it('reads a sheet smaller than a frame as one cell', () => {
    expect(layoutFromBlanks(100, 50, () => false)).toEqual({ columns: 1, rows: 1, rowNames: ['idle'], frames: [1] })
  })
})

describe('alphaIsBlank', () => {
  it('is blank while no alpha reaches 16', () => {
    expect(alphaIsBlank(new Uint8Array(64))).toBe(true)
    expect(alphaIsBlank(new Uint8Array(64).fill(15))).toBe(true)
    expect(alphaIsBlank(Uint8Array.from([0, 0, 16, 0]))).toBe(false)
  })

  it('samples every stride-th value, which reads the alphas of RGBA bytes', () => {
    const rgba = Uint8Array.from([255, 255, 255, 0, 255, 255, 255, 0])

    expect(alphaIsBlank(rgba.subarray(3), 4)).toBe(true)
    rgba[7] = 200
    expect(alphaIsBlank(rgba.subarray(3), 4)).toBe(false)
    expect(alphaIsBlank([0, 255, 0, 255], 2)).toBe(true)
  })
})

describe('poseRow', () => {
  it('finds each pose on a Codex sheet by its aliases, six frames at most', () => {
    expect(poseRow('idle', codex)).toEqual({ row: 0, frames: 6, mirror: false })
    expect(poseRow('wave', codex)).toEqual({ row: 3, frames: 4, mirror: false })
    expect(poseRow('jump', codex)).toEqual({ row: 4, frames: 5, mirror: false })
    expect(poseRow('failed', codex)).toEqual({ row: 5, frames: 6, mirror: false })
    expect(poseRow('waiting', codex)).toEqual({ row: 6, frames: 6, mirror: false })
    expect(poseRow('run', codex)).toEqual({ row: 7, frames: 6, mirror: false })
    expect(poseRow('review', codex)).toEqual({ row: 8, frames: 6, mirror: false })
  })

  it('walks on the directional rows of a Codex sheet, at their full length', () => {
    expect(poseRow('walk-right', codex)).toEqual({ row: 1, frames: 8, mirror: false })
    expect(poseRow('walk-left', codex)).toEqual({ row: 2, frames: 8, mirror: false })
  })

  it('finds the legacy names, and mirrors the run row for a walk to the left', () => {
    expect(poseRow('wave', legacy)).toEqual({ row: 1, frames: 4, mirror: false })
    expect(poseRow('run', legacy)).toEqual({ row: 2, frames: 6, mirror: false })
    expect(poseRow('failed', legacy)).toEqual({ row: 3, frames: 6, mirror: false })
    expect(poseRow('review', legacy)).toEqual({ row: 4, frames: 6, mirror: false })
    expect(poseRow('jump', legacy)).toEqual({ row: 5, frames: 5, mirror: false })
    expect(poseRow('walk-right', legacy)).toEqual({ row: 2, frames: 9, mirror: false })
    expect(poseRow('walk-left', legacy)).toEqual({ row: 2, frames: 9, mirror: true })
  })

  it('mirrors a right-only run for a walk to the left', () => {
    const rightOnly: SheetLayout = { columns: 8, rows: 3, rowNames: ['idle', 'running-right', 'review'], frames: [6, 8, 6] }

    expect(poseRow('walk-left', rightOnly)).toEqual({ row: 1, frames: 8, mirror: true })
    expect(poseRow('walk-right', rightOnly)).toEqual({ row: 1, frames: 8, mirror: false })
  })

  it('falls back to the first row for a pose the sheet lacks, never past its rows', () => {
    const short = layoutFromBlanks(9 * PET_FRAME_WIDTH, 2 * PET_FRAME_HEIGHT, () => false)

    expect(poseRow('waiting', legacy)).toEqual({ row: 0, frames: 6, mirror: false })
    expect(short.rowNames).toEqual(['idle', 'wave'])
    expect(poseRow('run', short)).toEqual({ row: 0, frames: 6, mirror: false })
    expect(poseRow('walk-left', short)).toEqual({ row: 0, frames: 9, mirror: false })
  })
})

describe('poseFor', () => {
  it('shows each activity as its pose', () => {
    expect(poseFor('idle', 0, 0)).toBe('idle')
    expect(poseFor('thinking', 0, 0)).toBe('review')
    expect(poseFor('running', 0, 0)).toBe('run')
    expect(poseFor('cheering', 0, 0)).toBe('jump')
    expect(poseFor('drooping', 0, 0)).toBe('failed')
    expect(poseFor('waiting', 0, 0)).toBe('waiting')
  })

  it('waves when it starts listening, then waits on the person', () => {
    expect(poseFor('listening', 0, 0)).toBe('wave')
    expect(poseFor('listening', 0, PERK_MS - 1)).toBe('wave')
    expect(poseFor('listening', 0, PERK_MS)).toBe('waiting')
  })

  it('walks whatever it is doing', () => {
    expect(poseFor('thinking', -1, 0)).toBe('walk-left')
    expect(poseFor('waiting', 1, 5000)).toBe('walk-right')
  })
})

describe('frameAt', () => {
  it('steps through a pose and says when the next frame is due', () => {
    expect(frameAt('run', 6, 0, false)).toEqual({ frame: 0, nextMs: FRAME_MS })
    expect(frameAt('run', 6, 200, false)).toEqual({ frame: 1, nextMs: 160 })
    expect(frameAt('run', 6, 6 * FRAME_MS + 10, false)).toEqual({ frame: 0, nextMs: FRAME_MS - 10 })
    expect(frameAt('review', 6, 60_000, false)).toEqual({ frame: 3, nextMs: 120 })
  })

  it('walks at its own, quicker pace', () => {
    expect(WALK_FRAME_MS).toBeLessThan(FRAME_MS)
    expect(frameAt('walk-left', 8, WALK_FRAME_MS + 10, false)).toEqual({ frame: 1, nextMs: WALK_FRAME_MS - 10 })
    expect(frameAt('walk-right', 8, 7 * WALK_FRAME_MS, false)).toEqual({ frame: 7, nextMs: WALK_FRAME_MS })
  })

  it('plays idle twice after a change, then rests on its first frame with no timer', () => {
    const loops = IDLE_LOOPS * 6 * FRAME_MS

    expect(frameAt('idle', 6, loops - 1, false)).toEqual({ frame: 5, nextMs: 1 })
    expect(frameAt('idle', 6, loops, false)).toEqual({ frame: 0, nextMs: null })
    expect(frameAt('idle', 6, loops * 10, false)).toEqual({ frame: 0, nextMs: null })
  })

  it('holds the first frame under reduced motion, and on a row of one frame', () => {
    for (const pose of ['idle', 'run', 'walk-right', 'wave'] as const) {
      expect(frameAt(pose, 6, 500, true)).toEqual({ frame: 0, nextMs: null })
    }

    expect(frameAt('run', 1, 500, false)).toEqual({ frame: 0, nextMs: null })
  })

  it('starts from the first frame when the time is not yet known', () => {
    expect(frameAt('run', 6, -50, false)).toEqual({ frame: 0, nextMs: FRAME_MS })
    expect(frameAt('run', 6, Number.NaN, false)).toEqual({ frame: 0, nextMs: FRAME_MS })
  })
})
