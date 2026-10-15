import { IconEyeOff, IconPaw, IconPlugConnectedX, IconRefreshAlert } from '@tabler/icons-react'
import type { ComponentType } from 'react'
import { AppTile } from '../../../components/app-icon.tsx'
import { Pill, type PillTone } from '../../../components/ui/glass.tsx'
import { cn } from '../../../lib/cn.ts'
import type { RoomSummary } from '../model/summary.ts'
import { type CountId, countsOf, type RoomNotice, type RoomNoticeId } from './labels.ts'

const COUNT_TONES: Record<CountId, PillTone> = { working: 'progress', waiting: 'warn', idle: 'muted', helpers: 'muted' }

const NOTICE_ICONS: Record<RoomNoticeId, ComponentType<{ size?: number; className?: string }>> = {
  offline: IconPlugConnectedX,
  toolProgress: IconEyeOff,
  caps: IconRefreshAlert,
  noPets: IconPaw
}

/** The Room's title, what is under way, and what keeps it from showing everything. */
export function RoomHeader({ summary, notices, onPetSettings }: { summary: RoomSummary | null; notices: readonly RoomNotice[]; onPetSettings?: () => void }) {
  const counts = summary ? countsOf(summary) : []

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-line px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <AppTile id="room" size={30} />
        <h1 className="shrink-0 text-[14px] leading-tight font-semibold text-fg">Pet Room</h1>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
          {counts.map(count => (
            <Pill key={count.id} tone={COUNT_TONES[count.id]} dot={count.id === 'working' || count.id === 'waiting'}>
              {count.text}
            </Pill>
          ))}
        </div>
      </div>
      {notices.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {notices.map(notice => {
            const Glyph = NOTICE_ICONS[notice.id]

            return (
              <div key={notice.id} className={cn('flex min-w-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px]', notice.id === 'offline' ? 'bg-warn/12 text-warn' : 'bg-white/6 text-fg-2')}>
                <Glyph size={13} className="shrink-0" />
                <span className="min-w-0">{notice.text}</span>
                {notice.id === 'noPets' && onPetSettings && (
                  <button type="button" onClick={onPetSettings} className="ml-1 shrink-0 text-accent-strong hover:underline">
                    Open Settings
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
