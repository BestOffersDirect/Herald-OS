import type { ApprovalChoice } from '@herald-os/client'
import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { petShown } from '../../../shared/pet.ts'
import { $connection } from '../../store/gateway.ts'
import { runCommand } from '../../store/os-commands.ts'
import { isMainSurface, openSurface, relayToMain, surface } from '../../store/shell.ts'
import { $petPrefs } from '../pet/actions.ts'
import { useDocumentVisible, useReducedMotion } from '../pet/hooks.ts'
import { $petInfo } from '../pet/info.ts'
import { assignPets, type PetAssignment } from '../petdex/assign.ts'
import { spriteCache } from '../petdex/cache.ts'
import { factsOf } from './model/facts.ts'
import { summarizeRoom } from './model/summary.ts'
import type { RoomAgent, RoomFact } from './model/types.ts'
import { $roomPrefs } from './prefs.ts'
import { roomNotices, sameFacts } from './scene/labels.ts'
import { RoomScene } from './scene/RoomScene.tsx'
import { $room, answerRoomApproval, openRoomAgent, useRoomFeed } from './store.ts'

/** Facts that grow with time ('quiet for 4 minutes during a turn') are worked out again this often. */
const FACTS_MS = 30_000

/** The time now, again every `everyMs` while `running`. */
function useNow(everyMs: number, running: boolean): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!running) {
      return
    }

    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), everyMs)

    return () => clearInterval(timer)
  }, [everyMs, running])

  return now
}

/** Settings > Pet, in the Hermes window (its own window in panels mode). */
function openPetSettings(): void {
  if (isMainSurface) {
    void runCommand('settings.open', { section: 'pet' }, { source: 'ui' })

    return
  }

  relayToMain({ type: 'os', args: ['settings.open'], payload: { section: 'pet' } })
  openSurface('main')
}

const answer = (agentId: string, choice: ApprovalChoice) => void answerRoomApproval(agentId, choice)

/** Each agent's pet and tint, kept steady while others come and go. */
export function useRoomAssignment(agents: readonly RoomAgent[]): Record<string, PetAssignment> {
  const prefs = useStore($roomPrefs)
  const info = useStore($petInfo)
  const petPrefs = useStore($petPrefs)
  // In desktop mode the desktop pet draws from the same cache, so it keeps a sheet of its own there.
  const cap = surface === 'desktop' && petShown(info) && !petPrefs.hidden ? spriteCache.cap - 1 : spriteCache.cap
  const previous = useRef<Record<string, PetAssignment>>({})

  return useMemo(() => {
    const next = assignPets(agents, info.installed, prefs, previous.current, cap)
    previous.current = next

    return next
  }, [agents, info.installed, prefs, cap])
}

/** The Room's window content, in a floating window (desktop mode, `active` false while minimized) or its own window (panels mode). */
export function RoomWindow({ active = true }: { active?: boolean }) {
  const visible = useDocumentVisible()
  const live = active && visible
  useRoomFeed(live)
  const state = useStore($room)
  const prefs = useStore($roomPrefs)
  const info = useStore($petInfo)
  const connection = useStore($connection)
  const reduced = useReducedMotion()
  const now = useNow(FACTS_MS, live)
  const agents = useMemo(() => Object.values(state.agents), [state.agents])
  const assignment = useRoomAssignment(agents)
  const shownFacts = useRef<Record<string, RoomFact[]>>({})
  const facts = useMemo(() => {
    const before = shownFacts.current
    const next = Object.fromEntries(
      agents.map(agent => {
        const fresh = factsOf(agent, state, now)
        const kept = before[agent.id]

        return [agent.id, kept && sameFacts(kept, fresh) ? kept : fresh]
      })
    )
    shownFacts.current = next

    return next
  }, [agents, state, now])
  const summary = useMemo(() => summarizeRoom(state, now), [state, now])
  const notices = useMemo(
    () => roomNotices({ connected: connection === 'open', state: { toolProgress: state.toolProgress, caps: state.caps }, pets: info.installed.length }),
    [connection, state.toolProgress, state.caps, info.installed.length]
  )
  const desks = useMemo(() => Object.values(state.desks ?? {}), [state.desks])

  return (
    <RoomScene
      agents={agents}
      handoffs={state.handoffs}
      assignment={assignment}
      installed={info.installed}
      steps={prefs.steps}
      motion={reduced ? 'still' : prefs.motion}
      active={live}
      settled={state.updatedAt > 0}
      facts={facts}
      desks={desks}
      deskNames={prefs.deskNames}
      lane={prefs.elsewhere}
      summary={summary}
      notices={notices}
      onOpen={openRoomAgent}
      onAnswer={answer}
      onPetSettings={openPetSettings}
    />
  )
}
