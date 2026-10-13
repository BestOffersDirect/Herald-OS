import { describe, expect, it } from 'vitest'
import type { BatteryStatus, DiskUsage, SystemStats } from '../../../shared/ipc.ts'
import type { PetMood, PetNote } from '../../../shared/pet.ts'
import { batteryMood, diskMood, jobNote, LONG_JOB_MS, NoteGate, nextMood, updateNote } from './moods.ts'

const GIB = 1024 ** 3
const disk = (mount: string, totalGib: number, freeGib: number): DiskUsage => ({ mount, total: totalGib * GIB, free: freeGib * GIB, used: (totalGib - freeGib) * GIB })
const roomy = [disk('/', 500, 200)]
const plugged: BatteryStatus = { present: true, percent: 80, charging: true }
const stats = (disks: DiskUsage[], battery: BatteryStatus = plugged): SystemStats => ({ sampledAt: 0, cpuPercent: 0, loadAverage: [0, 0, 0], memoryTotal: 0, memoryUsed: 0, memoryFree: 0, uptimeSeconds: 0, disks, battery })
const both = { disk: true, battery: true }
const lowBattery: PetMood = { kind: 'battery', text: 'Battery at 12%: time to plug in' }
const fullDisk: PetMood = { kind: 'disk', text: 'The disk is nearly full: 3.2 GB left' }

describe('diskMood', () => {
  it('worries about the disk holding home, the longest mount it lies in', () => {
    const disks = [disk('/', 500, 200), disk('/home', 1000, 10)]

    expect(diskMood(disks, '/home/luke')).toEqual({ kind: 'disk', text: 'The disk is nearly full: 10.0 GB left' })
    expect(diskMood(disks, '/homework/luke')).toBeNull()
    expect(diskMood(disks)).toBeNull()
  })

  it('worries under 5% free or under 5 GiB free', () => {
    expect(diskMood([disk('/', 2000, 60)])).toEqual({ kind: 'disk', text: 'The disk is nearly full: 60.0 GB left' })
    expect(diskMood([disk('/', 32, 3.2)], '/Users/luke')).toEqual(fullDisk)
    expect(diskMood([disk('/', 100, 5)])).toBeNull()
    expect(diskMood(roomy)).toBeNull()
  })

  it('ignores disks that report no size', () => {
    expect(diskMood([disk('/', 0, 0)])).toBeNull()
    expect(diskMood([])).toBeNull()
  })
})

describe('batteryMood', () => {
  it('worries at 15% or less, on battery', () => {
    expect(batteryMood({ present: true, percent: 12, charging: false })).toEqual(lowBattery)
    expect(batteryMood({ present: true, percent: 15, charging: false })?.text).toBe('Battery at 15%: time to plug in')
    expect(batteryMood({ present: true, percent: 16, charging: false })).toBeNull()
    expect(batteryMood({ present: true, percent: 5, charging: true })).toBeNull()
    expect(batteryMood({ present: false })).toBeNull()
    expect(batteryMood({ present: true, charging: false })).toBeNull()
    expect(batteryMood(undefined)).toBeNull()
  })
})

describe('nextMood', () => {
  const draining = (percent: number): BatteryStatus => ({ present: true, percent, charging: false })

  it('puts the battery before the disk', () => {
    expect(nextMood(null, stats([disk('/', 32, 3.2)], draining(12)), both)).toEqual(lowBattery)
    expect(nextMood(fullDisk, stats([disk('/', 32, 3.2)], draining(12)), both)).toEqual(lowBattery)
    expect(nextMood(null, stats([disk('/', 32, 3.2)], draining(12)), { disk: true, battery: false })).toEqual(fullDisk)
  })

  it('keeps a battery mood until charging or over 20%', () => {
    expect(nextMood(lowBattery, stats(roomy, draining(18)), both)).toEqual({ kind: 'battery', text: 'Battery at 18%: time to plug in' })
    expect(nextMood(lowBattery, stats(roomy, draining(20)), both)?.kind).toBe('battery')
    expect(nextMood(lowBattery, stats(roomy, draining(21)), both)).toBeNull()
    expect(nextMood(lowBattery, stats(roomy, { present: true, percent: 10, charging: true }), both)).toBeNull()
    expect(nextMood(null, stats(roomy, draining(18)), both)).toBeNull()
  })

  it('keeps a disk mood until over 8% and over 8 GiB free', () => {
    expect(nextMood(fullDisk, stats([disk('/', 100, 7.5)]), both)).toEqual({ kind: 'disk', text: 'The disk is nearly full: 7.5 GB left' })
    expect(nextMood(null, stats([disk('/', 100, 7.5)]), both)).toBeNull()
    expect(nextMood(fullDisk, stats([disk('/', 1000, 60)]), both)?.kind).toBe('disk')
    expect(nextMood(fullDisk, stats([disk('/', 1000, 80)]), both)?.kind).toBe('disk')
    expect(nextMood(fullDisk, stats([disk('/', 50, 8)]), both)?.kind).toBe('disk')
    expect(nextMood(fullDisk, stats([disk('/', 100, 9)]), both)).toBeNull()
  })

  it('shows only the moods turned on', () => {
    expect(nextMood(null, stats([disk('/', 32, 3.2)], draining(12)), { disk: false, battery: false })).toBeNull()
    expect(nextMood(lowBattery, stats(roomy, draining(12)), { disk: true, battery: false })).toBeNull()
  })

  it('keeps the last mood while the machine cannot say, unless it was turned off', () => {
    expect(nextMood(lowBattery, null, both)).toEqual(lowBattery)
    expect(nextMood(lowBattery, null, { disk: true, battery: false })).toBeNull()
    expect(nextMood(null, null, both)).toBeNull()
  })
})

describe('updateNote', () => {
  const raw = (summary: unknown) => JSON.stringify({ summary, checkedAt: 1 })

  it('brings the update the menu bar saw, named by its summary', () => {
    const note = updateNote(raw('Herald OS, 192 packages, 3 apps'), true)

    expect(note).toEqual({ id: 'update:Herald OS, 192 packages, 3 apps', kind: 'update', text: 'Update ready: Herald OS, 192 packages, 3 apps', sessionId: null })
    expect(updateNote(raw('Herald OS, 192 packages, 3 apps'), true)?.id).toBe(note?.id)
    expect(updateNote(raw('Herald OS, 193 packages, 3 apps'), true)?.id).not.toBe(note?.id)
  })

  it('brings nothing when turned off, up to date or unreadable', () => {
    expect(updateNote(raw('Herald OS'), false)).toBeNull()
    expect(updateNote(null, true)).toBeNull()
    expect(updateNote('{not json', true)).toBeNull()
    expect(updateNote(raw('  '), true)).toBeNull()
    expect(updateNote(raw(42), true)).toBeNull()
    expect(updateNote('null', true)).toBeNull()
  })
})

describe('jobNote', () => {
  const job = { sessionId: 'session-7', title: 'Tidy the Downloads folder', startedAt: 1_000, endedAt: 1_000 + LONG_JOB_MS }

  it('brings a note when a job ran two minutes or more', () => {
    expect(LONG_JOB_MS).toBe(120_000)
    expect(jobNote(job, true)).toEqual({ id: `job:session-7:${job.endedAt}`, kind: 'job', text: 'Finished: Tidy the Downloads folder', sessionId: 'session-7' })
    expect(jobNote({ ...job, title: ' ' }, true)?.text).toBe('Finished: a long job')
  })

  it('brings nothing for a quick job, or when turned off', () => {
    expect(jobNote({ ...job, endedAt: job.endedAt - 1 }, true)).toBeNull()
    expect(jobNote(job, false)).toBeNull()
    expect(jobNote({ ...job, endedAt: Number.NaN }, true)).toBeNull()
  })
})

describe('NoteGate', () => {
  const MINUTE = 60_000
  const note = (id: string, kind: PetNote['kind'] = 'job'): PetNote => ({ id, kind, text: id, sessionId: null })

  it('lets a note show, and keeps it showing', () => {
    const gate = new NoteGate()

    expect(gate.allow(note('a'), 0)).toBe(true)
    expect(gate.allow(note('a'), 5 * MINUTE)).toBe(true)
  })

  it('holds back another of the same kind for 20 minutes, not one of another kind', () => {
    const gate = new NoteGate()

    gate.allow(note('a'), 0)
    expect(gate.allow(note('b'), 19 * MINUTE)).toBe(false)
    expect(gate.allow(note('update', 'update'), 19 * MINUTE)).toBe(true)
    expect(gate.allow(note('b'), 20 * MINUTE)).toBe(true)
    expect(gate.allow(note('a'), 21 * MINUTE)).toBe(false)
  })

  it('never brings a dismissed note back', () => {
    const gate = new NoteGate()

    gate.allow(note('a'), 0)
    gate.dismiss(note('a'))
    expect(gate.allow(note('a'), 0)).toBe(false)
    expect(gate.allow(note('a'), 600 * MINUTE)).toBe(false)
  })

  it('takes its own gap', () => {
    const gate = new NoteGate(MINUTE)

    gate.allow(note('a'), 0)
    expect(gate.allow(note('b'), MINUTE - 1)).toBe(false)
    expect(gate.allow(note('b'), MINUTE)).toBe(true)
  })
})
