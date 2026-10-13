import { useStore } from '@nanostores/react'
import { type HTMLAttributes, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PET_FRAME_HEIGHT, PET_FRAME_WIDTH, type PetCover, type PetPrefs, type PetRect, type PetSnapshot, type PetWindowPlacement } from '../../../shared/pet.ts'
import type { WmState } from '../../../shared/ipc.ts'
import { $wm, onShellCommand } from '../../store/shell.ts'
import { $petPrefs, setPetPrefs } from './actions.ts'
import { fullscreenInFront, petHiddenWhy } from './hide.ts'
import { extrasOf, petPose, useDocumentVisible, usePetUi, useReducedMotion, useSince, useWakeAfter } from './hooks.ts'
import { $petInfo, $petSheet } from './info.ts'
import { PetView } from './PetView.tsx'
import { avoid, clampPoint, cursorRect, type Point, type Size, spotFromPoint, walkTo } from './placement.ts'
import type { LoadedSheet } from './sheet.ts'
import { PERK_MS } from './sprite.ts'
import { extrasLayout, followRectPanels, stageTarget, windowFor } from './stage.ts'
import { $petSnapshot, petBridge } from './transport.ts'

/*
 * Panels mode: the pet is a small transparent window of its own (niri floats it and never focuses it
 * on open). It sizes and places that window around itself and what it holds, moves it to walk, and
 * takes the keys only while its chat or drop box is open. niri tells it about other windows; main
 * tells it when one of Herald's own is full screen or presenting.
 */

const PET_TITLE = 'Herald OS · Pet'
/** The menu bar's and the dock's strips (niri's struts in linux/niri/config.kdl). */
const MENU_BAR = 30
const DOCK = 84
/** Room around the pet and its bubble for their shadows. */
const PAD = 10
const EXTRAS_PAD = 22
const STEP_MS = 50
const DRAG_MS = 33
const LINGER_MS = 1600
const DODGE_MS = 45_000

const NO_COVER: PetCover = { fullscreen: false, presenting: false }

function useCover(): PetCover {
  const [cover, setCover] = useState<PetCover>(NO_COVER)

  useEffect(() => petBridge()?.onCover(setCover), [])

  return cover
}

function useWorkArea(wm: WmState): PetRect | null {
  const [area, setArea] = useState<PetRect | null>(null)
  const outputs = wm.workspaces.map(ws => ws.output ?? '').join('|')

  useEffect(() => {
    void petBridge()
      ?.workArea()
      .then(next => setArea(previous => (previous && previous.x === next.x && previous.y === next.y && previous.width === next.width && previous.height === next.height ? previous : next)))
      .catch(() => undefined)
  }, [outputs])

  return area
}

/** Step the window to each new point at a walking pace (at once when instant). */
function useStepWalk(goal: Point, instant: boolean): { point: Point; dir: -1 | 0 | 1; moving: boolean } {
  const [state, setState] = useState<{ point: Point; dir: -1 | 0 | 1; moving: boolean }>({ point: goal, dir: 0, moving: false })
  const current = useRef(goal)

  useEffect(() => {
    const from = current.current

    if (from.x === goal.x && from.y === goal.y) {
      return
    }

    const walk = walkTo(from, goal)

    if (instant || walk.ms < STEP_MS) {
      current.current = goal
      setState({ point: goal, dir: 0, moving: false })

      return
    }

    const start = Date.now()
    let timer: ReturnType<typeof setTimeout> | null = null
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / walk.ms)
      const at = { x: Math.round(from.x + (goal.x - from.x) * t), y: Math.round(from.y + (goal.y - from.y) * t) }
      current.current = at
      setState({ point: at, dir: t < 1 ? walk.dir : 0, moving: t < 1 })

      if (t < 1) {
        timer = setTimeout(step, STEP_MS)
      }
    }

    step()

    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [goal.x, goal.y, instant])

  return state
}

function WindowPet({ sheet, scale, snapshot, prefs, output, wm }: { sheet: LoadedSheet; scale: number; snapshot: PetSnapshot; prefs: PetPrefs; output: PetRect; wm: WmState }) {
  const size: Size = { width: Math.round(PET_FRAME_WIDTH * scale), height: Math.round(PET_FRAME_HEIGHT * scale) }
  const area: PetRect = { x: output.x, y: output.y + MENU_BAR, width: output.width, height: Math.max(size.height, output.height - MENU_BAR - DOCK) }
  const ui = usePetUi(snapshot)
  const reduced = useReducedMotion()
  const visible = useDocumentVisible()
  const groupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [group, setGroup] = useState<Size>(size)
  const [dodge, setDodge] = useState<Point | null>(null)
  const [drag, setDrag] = useState<Point | null>(null)
  const [localSpot, setLocalSpot] = useState<{ x: number; y: number } | null>(null)
  const [leftFollow, setLeftFollow] = useState<number | null>(null)
  const [dropping, setDropping] = useState(false)
  const focusedWorkspace = wm.workspaces.find(ws => ws.focused)?.id ?? null

  const follow = snapshot.follow && snapshot.follow.at !== leftFollow && !ui.bubble && !ui.drop ? followRectPanels(wm.windows, focusedWorkspace, snapshot.follow, output, area) : null
  const target = stageTarget({ area, size, spot: localSpot ?? prefs.spot, approval: Boolean(snapshot.approval), follow, dodge, obstacles: [] })
  const goal = drag ?? target.point
  const walk = useStepWalk(goal, reduced || drag !== null)
  const extras = extrasOf(snapshot, ui, !walk.moving)
  const layout = extrasLayout(goal, size, area)
  // The window's edge cuts off what is drawn past it: room for the shadow of a bubble or a card.
  const pad = extras ? EXTRAS_PAD : PAD
  const placement: PetWindowPlacement = windowFor(walk.point, size, group, layout, pad)
  const activitySince = useSince(snapshot.activity)
  const { pose, rest } = petPose(snapshot, walk.dir, activitySince, { dragging: drag !== null, dropping })
  const poseSince = useSince(pose)
  useWakeAfter(snapshot.activity === 'listening' ? PERK_MS - (Date.now() - activitySince) : null)

  const placed = useRef(placement)
  placed.current = placement
  const pointRef = useRef(walk.point)
  pointRef.current = walk.point
  const interactive = extras === 'bubble' || extras === 'drop'

  useLayoutEffect(() => {
    const element = groupRef.current

    if (!element) {
      return
    }

    const measure = () => setGroup(previous => (previous.width === element.offsetWidth && previous.height === element.offsetHeight ? previous : { width: element.offsetWidth, height: element.offsetHeight }))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    void petBridge()?.place(placement).catch(() => undefined)
  }, [placement.x, placement.y, placement.width, placement.height])

  useEffect(() => {
    void petBridge()
      ?.setInteractive(interactive)
      .then(() => {
        if (interactive) {
          inputRef.current?.focus({ preventScroll: true })
        }
      })
      .catch(() => undefined)
  }, [interactive])

  useEffect(() => () => void petBridge()?.setInteractive(false).catch(() => undefined), [])

  useEffect(() => {
    if (localSpot && prefs.spot && Math.abs(prefs.spot.x - localSpot.x) < 0.001 && Math.abs(prefs.spot.y - localSpot.y) < 0.001) {
      setLocalSpot(null)
    }
  }, [prefs.spot, localSpot])

  useEffect(
    () =>
      onShellCommand(command => {
        if (command.type === 'pet-chat') {
          ui.setBubble(true)
        }
      }),
    []
  )

  useEffect(() => {
    if (!interactive) {
      return
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        ui.setDrop(null)
        ui.setBubble(false)
      }
    }
    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [interactive])

  useEffect(() => {
    if (!dodge) {
      return
    }

    const timer = setTimeout(() => setDodge(null), DODGE_MS)

    return () => clearTimeout(timer)
  }, [dodge])

  const busy = ui.bubble || ui.drop !== null || snapshot.approval !== null || drag !== null
  const linger = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointer = useRef<Point | null>(null)
  const press = useRef<{ x: number; y: number; origin: Point; moved: boolean; id: number; at: number } | null>(null)
  const clearLinger = () => {
    if (linger.current) {
      clearTimeout(linger.current)
      linger.current = null
    }
  }
  const screenOf = (clientX: number, clientY: number): Point => ({ x: placed.current.x + clientX, y: placed.current.y + clientY })

  const spriteProps: HTMLAttributes<HTMLDivElement> = {
    onMouseDown: event => event.preventDefault(),
    onPointerEnter: event => {
      pointer.current = screenOf(event.clientX, event.clientY)
      clearLinger()

      if (!busy) {
        linger.current = setTimeout(() => {
          linger.current = null

          if (pointer.current && !press.current) {
            setDodge(avoid(pointRef.current, size, area, [cursorRect(pointer.current, 48)]))
          }
        }, LINGER_MS)
      }
    },
    onPointerLeave: () => {
      pointer.current = null
      clearLinger()
    },
    onPointerDown: event => {
      if (event.button !== 0) {
        return
      }

      event.preventDefault()
      clearLinger()
      event.currentTarget.setPointerCapture(event.pointerId)
      const at = screenOf(event.clientX, event.clientY)
      press.current = { x: at.x, y: at.y, origin: pointRef.current, moved: false, id: event.pointerId, at: 0 }
    },
    onPointerMove: event => {
      const current = press.current
      pointer.current = screenOf(event.clientX, event.clientY)

      if (!current || current.id !== event.pointerId) {
        return
      }

      const dx = pointer.current.x - current.x
      const dy = pointer.current.y - current.y

      if (!current.moved && Math.hypot(dx, dy) < 4) {
        return
      }

      current.moved = true
      const now = Date.now()

      if (now - current.at >= DRAG_MS) {
        current.at = now
        setDrag(clampPoint({ x: current.origin.x + dx, y: current.origin.y + dy }, size, area))
      }
    },
    onPointerUp: event => {
      const current = press.current
      press.current = null

      if (!current || current.id !== event.pointerId) {
        return
      }

      if (current.moved) {
        const at = screenOf(event.clientX, event.clientY)
        const dropped = clampPoint({ x: current.origin.x + at.x - current.x, y: current.origin.y + at.y - current.y }, size, area)
        const spot = spotFromPoint(dropped, size, area)
        setLocalSpot(spot)
        setDrag(null)
        setDodge(null)
        setLeftFollow(snapshot.follow?.at ?? null)
        void setPetPrefs({ spot }).catch(() => setLocalSpot(null))

        return
      }

      if (!snapshot.approval) {
        ui.setBubble(!ui.bubble)
      }
    },
    onPointerCancel: () => {
      press.current = null
      setDrag(null)
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <PetView
        sheet={sheet}
        scale={scale}
        snapshot={snapshot}
        ui={ui}
        extras={extras}
        layout={layout}
        pose={pose}
        poseSince={poseSince}
        rest={rest}
        reduced={reduced}
        paused={!visible}
        dropping={dropping}
        onDropping={setDropping}
        spriteProps={spriteProps}
        groupRef={groupRef}
        inputRef={inputRef}
        className="absolute"
        style={{ left: pad, top: pad }}
      />
    </div>
  )
}

/** Panels mode: the pet's own window. */
export function PetSurface() {
  const info = useStore($petInfo)
  const sheet = useStore($petSheet)
  const prefs = useStore($petPrefs)
  const snapshot = useStore($petSnapshot)
  const wm = useStore($wm)
  const cover = useCover()
  const output = useWorkArea(wm)
  const focusedWorkspace = wm.workspaces.find(ws => ws.focused)?.id ?? null
  const covered = output ? fullscreenInFront(wm.windows, focusedWorkspace, { width: output.width, height: output.height }, [PET_TITLE]) : false
  const why = petHiddenWhy({
    enabled: info.enabled,
    installed: Boolean(info.slug),
    hidden: prefs.hidden,
    fullscreen: cover.fullscreen || covered || snapshot.hiddenBy === 'fullscreen',
    presenting: cover.presenting || snapshot.hiddenBy === 'presenting',
    doNotDisturb: snapshot.hiddenBy === 'doNotDisturb'
  })
  const shown = !why && sheet !== null && output !== null

  useEffect(() => {
    void petBridge()?.setVisible(shown).catch(() => undefined)
  }, [shown])

  if (!shown || !sheet || !output) {
    return null
  }

  return <WindowPet sheet={sheet} scale={info.scale} snapshot={snapshot} prefs={prefs} output={output} wm={wm} />
}
