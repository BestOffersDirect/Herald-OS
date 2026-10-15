import {
  IconArmchair2,
  IconBrain,
  IconBrush,
  IconCode,
  IconFileText,
  IconFolder,
  IconHourglass,
  IconMessages,
  IconPlant2,
  IconPresentation,
  IconTable,
  IconTerminal2,
  IconWorld
} from '@tabler/icons-react'
import { type ComponentType, type CSSProperties, memo } from 'react'
import { HermesMark } from '../../../components/hermes-mark.tsx'
import { cn } from '../../../lib/cn.ts'
import type { RoomArea } from '../model/types.ts'
import type { Rect, SceneLayout, Station } from './layout.ts'

type Icon = ComponentType<{ size?: number; className?: string; stroke?: number }>

export const AREA_ICONS: Record<RoomArea, Icon> = {
  docs: IconFileText,
  sheets: IconTable,
  slides: IconPresentation,
  canvas: IconBrush,
  terminal: IconTerminal2,
  browser: IconWorld,
  files: IconFolder,
  studio: IconCode,
  memory: IconBrain,
  messages: IconMessages,
  bench: IconHourglass,
  lounge: IconArmchair2
}

const box = (rect: Rect) => ({ left: rect.x, top: rect.y, width: rect.width, height: rect.height })

/** A station's soft glow in one of the theme's colours; inline, as `.glass-card` sits above Tailwind's utilities. */
const glow = (color: string): CSSProperties => ({
  background: 'var(--color-glass-3)',
  borderColor: `color-mix(in srgb, ${color} 70%, transparent)`,
  boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 0 0 1px color-mix(in srgb, ${color} 30%, transparent), 0 0 30px color-mix(in srgb, ${color} 34%, transparent)`
})

function Tile({ station, unit, glowing, still }: { station: Station; unit: number; glowing: boolean; still: boolean }) {
  const Glyph = AREA_ICONS[station.id]
  const tile = Math.round(unit * 0.42)

  return (
    <div
      title={station.name}
      className="glass-card absolute flex flex-col items-center justify-center gap-1.5 rounded-xl px-2"
      style={{ ...box(station.rect), transitionDuration: still ? '0ms' : '700ms', ...(glowing ? glow('var(--color-progress)') : {}) }}
    >
      <span className="icon-tile shrink-0" style={{ width: tile, height: tile, borderRadius: Math.round(tile * 0.26) }}>
        <Glyph size={Math.round(tile * 0.56)} stroke={1.7} />
      </span>
      <span className={cn('max-w-full truncate text-[11.5px] leading-none font-medium', glowing ? 'text-fg' : 'text-fg-2')}>{station.label}</span>
    </div>
  )
}

function Bench({ station, glowing, still }: { station: Station; glowing: boolean; still: boolean }) {
  const { rect } = station
  const leg = Math.max(3, Math.round(rect.height * 0.12))

  return (
    <div className="absolute" style={box(rect)} title={station.name}>
      <div className="glass-card absolute inset-x-0 top-0 rounded-lg" style={{ height: Math.round(rect.height * 0.62), transitionDuration: still ? '0ms' : '700ms', ...(glowing ? glow('var(--color-warn)') : {}) }} />
      <div className="absolute rounded-b bg-white/10" style={{ left: '8%', width: leg, top: Math.round(rect.height * 0.62), bottom: 0 }} />
      <div className="absolute rounded-b bg-white/10" style={{ right: '8%', width: leg, top: Math.round(rect.height * 0.62), bottom: 0 }} />
      <FurnitureLabel station={station} />
    </div>
  )
}

function Sofa({ station, unit }: { station: Station; unit: number }) {
  const { rect } = station
  const arm = Math.round(rect.height * 0.32)

  return (
    <>
      <div className="absolute rounded-[50%] bg-accent-soft opacity-40" style={{ left: rect.x - unit * 0.3, width: rect.width + unit * 0.6, top: rect.y + rect.height * 0.45, height: rect.height * 0.9 }} />
      <div className="absolute" style={box(rect)} title={station.name}>
        <div className="glass-card absolute inset-x-0 top-0 rounded-xl" style={{ height: Math.round(rect.height * 0.62) }} />
        <div className="absolute inset-x-0 bottom-0 rounded-lg bg-glass-3 hairline" style={{ height: Math.round(rect.height * 0.5) }} />
        <div className="absolute bottom-0 left-0 rounded-lg bg-glass-3 hairline" style={{ width: arm, height: Math.round(rect.height * 0.72) }} />
        <div className="absolute right-0 bottom-0 rounded-lg bg-glass-3 hairline" style={{ width: arm, height: Math.round(rect.height * 0.72) }} />
        <FurnitureLabel station={station} />
      </div>
      <IconPlant2 className="absolute text-ok/50" size={Math.round(unit * 0.62)} stroke={1.4} style={{ left: rect.x - unit * 0.72, top: rect.y + rect.height - unit * 0.62 }} />
    </>
  )
}

function FurnitureLabel({ station }: { station: Station }) {
  const Glyph = AREA_ICONS[station.id]

  return (
    <span className="absolute top-full left-1/2 mt-1 flex -translate-x-1/2 items-center gap-1 text-[10.5px] whitespace-nowrap text-fg-4">
      <Glyph size={11} />
      {station.label}
    </span>
  )
}

function Door({ rect, unit }: { rect: Rect; unit: number }) {
  return (
    <div className="absolute flex flex-col items-center gap-1 rounded-t-[999px] rounded-b-md border border-line-strong bg-glass-2 shadow-card" style={{ ...box(rect), paddingTop: Math.round(rect.height * 0.24) }} title="The door to Hermes">
      <HermesMark size={Math.round(unit * 0.36)} className="text-accent-strong" />
      <span className="text-[10px] leading-none font-medium text-fg-3">Hermes</span>
      <span className="absolute top-[62%] right-[14%] size-1.5 rounded-full bg-fg-3" />
    </div>
  )
}

/** The room drawn once per size: walls, floor, stations and furniture; a station glows while a pet works there. */
export const RoomBackdrop = memo(function RoomBackdrop({ layout, glowing, still }: { layout: SceneLayout; glowing: ReadonlySet<RoomArea>; still: boolean }) {
  const { unit } = layout
  const lines = Math.max(18, Math.round(unit * 0.62))

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden="true">
      <div
        className="absolute inset-x-0 top-0 border-b border-line"
        style={{ height: layout.wall.height, background: 'linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 11%, transparent), color-mix(in srgb, var(--color-accent) 4%, transparent))' }}
      />
      <div className="absolute inset-x-0 bg-white/6" style={{ top: layout.wall.height - 4, height: 4 }} />
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          top: layout.wall.height,
          background: `radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 70%), repeating-linear-gradient(180deg, transparent 0 ${lines - 1}px, color-mix(in srgb, var(--color-line) 30%, transparent) ${lines - 1}px ${lines}px)`
        }}
      />
      {layout.stations.map(station =>
        station.wall !== 'front' ? (
          <Tile key={station.id} station={station} unit={unit} glowing={glowing.has(station.id)} still={still} />
        ) : station.id === 'lounge' ? (
          <Sofa key={station.id} station={station} unit={unit} />
        ) : (
          <Bench key={station.id} station={station} glowing={glowing.has(station.id)} still={still} />
        )
      )}
      <Door rect={layout.door} unit={unit} />
    </div>
  )
})
