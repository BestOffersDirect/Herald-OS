import type { BatteryStatus, DiskUsage, SystemStats } from '../../../shared/ipc.ts'
import type { PetMood, PetMoodKind, PetNote, PetNoteKind } from '../../../shared/pet.ts'
import { formatBytes, truncate } from '../../lib/format.ts'

/*
 * The pet's moods from the machine (worried when the disk is nearly full or the battery low) and the
 * quiet notes it brings (an update ready, a long job done). A mood holds until the machine is clearly
 * better, so it does not flicker on and off around its threshold.
 */

export const LONG_JOB_MS = 120_000

const GIB = 1024 ** 3
const BATTERY_LOW = 15
const BATTERY_CLEAR = 20
const NOTE_TEXT = 60

const nearlyFull = (disk: DiskUsage): boolean => disk.free < 5 * GIB || disk.free / disk.total < 0.05
const stillFull = (disk: DiskUsage): boolean => disk.free <= 8 * GIB || disk.free / disk.total <= 0.08

/** The disk holding `home` (the longest mount it lies in), else the one mounted at `/`. */
function homeDisk(disks: readonly DiskUsage[], home?: string): DiskUsage | null {
  const known = disks.filter(disk => disk.total > 0 && Number.isFinite(disk.free))
  const holding = home ? known.filter(disk => home === disk.mount || home.startsWith(disk.mount.endsWith('/') ? disk.mount : `${disk.mount}/`)).sort((a, b) => b.mount.length - a.mount.length) : []

  return holding[0] ?? known.find(disk => disk.mount === '/') ?? null
}

const diskText = (disk: DiskUsage): string => `The disk is nearly full: ${formatBytes(disk.free)} left`
const batteryText = (percent: number): string => `Battery at ${Math.round(percent)}%: time to plug in`

export function diskMood(disks: readonly DiskUsage[], home?: string): PetMood | null {
  const disk = homeDisk(disks, home)

  return disk && nearlyFull(disk) ? { kind: 'disk', text: diskText(disk) } : null
}

const draining = (battery: BatteryStatus | undefined, limit: number): battery is BatteryStatus & { percent: number } =>
  Boolean(battery?.present && !battery.charging && typeof battery.percent === 'number' && battery.percent <= limit)

export function batteryMood(battery: BatteryStatus | undefined): PetMood | null {
  return draining(battery, BATTERY_LOW) ? { kind: 'battery', text: batteryText(battery.percent) } : null
}

export function nextMood(previous: PetMood | null, stats: SystemStats | null, enabled: Record<PetMoodKind, boolean>, home?: string): PetMood | null {
  if (!stats) {
    return previous && enabled[previous.kind] ? previous : null
  }

  if (enabled.battery) {
    const battery = stats.battery

    if (previous?.kind === 'battery' && draining(battery, BATTERY_CLEAR)) {
      return { kind: 'battery', text: batteryText(battery.percent) }
    }

    const low = batteryMood(battery)

    if (low) {
      return low
    }
  }

  if (!enabled.disk) {
    return null
  }

  const disk = homeDisk(stats.disks ?? [], home)

  if (previous?.kind === 'disk' && disk && stillFull(disk)) {
    return { kind: 'disk', text: diskText(disk) }
  }

  return diskMood(stats.disks ?? [], home)
}

export function updateNote(raw: string | null, enabled: boolean): PetNote | null {
  if (!enabled || !raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as { summary?: unknown } | null
    const summary = typeof parsed?.summary === 'string' ? parsed.summary.trim() : ''

    return summary ? { id: `update:${summary}`, kind: 'update', text: `Update ready: ${truncate(summary, NOTE_TEXT)}`, sessionId: null } : null
  } catch {
    return null
  }
}

export function jobNote(job: { sessionId: string; title: string; startedAt: number; endedAt: number }, enabled: boolean): PetNote | null {
  if (!enabled || !(job.endedAt - job.startedAt >= LONG_JOB_MS)) {
    return null
  }

  return { id: `job:${job.sessionId}:${job.endedAt}`, kind: 'job', text: `Finished: ${truncate(job.title.trim() || 'a long job', NOTE_TEXT)}`, sessionId: job.sessionId }
}

const NOTE_GAP_MS = 20 * 60_000

/** Which notes may show: one of a kind at most every `minGapMs` (the one showing stays allowed), and never one dismissed. */
export class NoteGate {
  private readonly minGapMs: number
  private readonly shown = new Map<PetNoteKind, { id: string; at: number }>()
  private readonly dismissed = new Set<string>()

  constructor(minGapMs = NOTE_GAP_MS) {
    this.minGapMs = minGapMs
  }

  allow(note: PetNote, now: number): boolean {
    if (this.dismissed.has(note.id)) {
      return false
    }

    const last = this.shown.get(note.kind)

    if (last?.id === note.id) {
      return true
    }

    if (last && now - last.at < this.minGapMs) {
      return false
    }

    this.shown.set(note.kind, { id: note.id, at: now })

    return true
  }

  dismiss(note: PetNote): void {
    this.dismissed.add(note.id)
  }
}
