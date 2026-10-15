import { useStore } from '@nanostores/react'
import { IconBroadcast, IconBubbleText, IconColorSwatch, IconDeviceDesktop, IconFileText, IconMessages, IconPaw, IconRepeat, IconSofa, IconSubtask, IconTarget, IconWalk } from '@tabler/icons-react'
import { type ReactNode, useState } from 'react'
import type { RoomKind, RoomMotion, RoomPrefsPatch } from '../../../shared/room.ts'
import { Chips, GlassButton, Toggle } from '../../components/ui/glass.tsx'
import { useT } from '../../store/i18n.ts'
import { openApp } from '../../store/windows.ts'
import { useReducedMotion } from '../pet/hooks.ts'
import { $petInfo } from '../pet/info.ts'
import { kindPets } from '../petdex/assign.ts'
import { PetFigure } from '../petdex/PetFigure.tsx'
import { errorText, focusSettings, InlineNote, markSaved, MenuDropdown, SectionTitle, SettingsGroup, SettingsRow } from '../settings/sections/shared.tsx'
import { $roomPrefs, setRoomPrefs } from './prefs.ts'

/*
 * Settings > Pet Room. Which pet stands for each kind of work and how the Room moves are Herald's
 * own (prefs.json `room`); the pets are the ones installed for Hermes, borrowed as they are.
 */

/** The kinds of work the Room shows; work outside Herald only while its lane is on. */
const KINDS: { kind: RoomKind; label: string; description: string; icon: ReactNode }[] = [
  { kind: 'conversation', label: 'Conversations', description: 'Each chat Hermes is working in.', icon: <IconMessages /> },
  { kind: 'mission', label: 'Missions', description: 'Each mission Hermes is working through.', icon: <IconTarget /> },
  { kind: 'helper', label: 'Helpers', description: 'The helpers Hermes hands part of a task to.', icon: <IconSubtask /> },
  { kind: 'automation', label: 'Automations', description: 'Each automation on your Automations page.', icon: <IconRepeat /> },
  { kind: 'elsewhere', label: 'Hermes outside Herald', description: 'Work in the lane for Hermes outside Herald.', icon: <IconBroadcast /> }
]

const MOTIONS: { id: RoomMotion; label: string; description: string }[] = [
  { id: 'full', label: 'Full', description: 'Pets walk between areas as their work moves.' },
  { id: 'calm', label: 'Calm', description: 'Pets appear where they work, without walking.' },
  { id: 'still', label: 'Still', description: 'Still frames: nothing moves.' }
]

/** The menu's id for "Pick for me": a pet's folder name is never empty. */
const PICK = ''

function PetPreview({ slug, still }: { slug: string | null; still: boolean }) {
  return (
    <span className="flex size-12 items-center justify-center overflow-hidden rounded-lg bg-white/6">
      {slug ? <PetFigure slug={slug} scale={0.22} still={still} /> : <IconPaw size={18} className="text-fg-4" />}
    </span>
  )
}

export function RoomSection() {
  const t = useT()
  const info = useStore($petInfo)
  const prefs = useStore($roomPrefs)
  const reduced = useReducedMotion()
  const [error, setError] = useState<string | null>(null)
  const motion = MOTIONS.find(item => item.id === prefs.motion) ?? MOTIONS[0]

  const save = (patch: RoomPrefsPatch) => {
    setError(null)
    setRoomPrefs(patch).then(markSaved, reason => setError(errorText(reason)))
  }

  const picked = kindPets(info.installed, prefs)

  const petRow = ({ kind, label, description, icon }: (typeof KINDS)[number]) => {
    const chosen = prefs.pets[kind]
    const pet = info.installed.find(entry => entry.slug === chosen)

    return (
      <SettingsRow key={kind} icon={icon} label={label} description={chosen && !pet ? `${chosen} is no longer installed, so the Room picks a pet by itself.` : description} keywords="pet room kind work petdex installed pick">
        <PetPreview slug={picked[kind]} still={reduced || prefs.motion === 'still'} />
        <MenuDropdown
          ariaLabel={`Pet for ${label.toLowerCase()}`}
          label={pet?.displayName ?? 'Pick for me'}
          value={pet?.slug ?? PICK}
          items={[{ id: PICK, label: 'Pick for me', description: 'The Room picks one of the installed pets.' }, ...info.installed.map(entry => ({ id: entry.slug, label: entry.displayName }))]}
          onSelect={slug => save({ pets: { ...prefs.pets, [kind]: slug === PICK ? null : slug } })}
        />
      </SettingsRow>
    )
  }

  return (
    <>
      <SectionTitle title={t('settings.section.room')} subtitle={t('settings.room.subtitle')} />
      {error && <InlineNote tone="danger">{error}</InlineNote>}

      <SettingsGroup title="The Room">
        <SettingsRow icon={<IconSofa />} label="Open the Pet Room" description="Watch Hermes at work: each pet stands at the tool its work uses and holds up what waits for you. Missions and the Dock open it too." keywords="pet room open window watch agents">
          <GlassButton size="sm" onClick={() => openApp('room')}>
            Open
          </GlassButton>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="A pet for each kind of work">
        {info.installed.length > 0 ? (
          KINDS.filter(row => row.kind !== 'elsewhere' || prefs.elsewhere).map(petRow)
        ) : (
          <SettingsRow icon={<IconPaw />} label="No pet is installed yet" description="The Room borrows the pets installed for Hermes and never installs one: Settings, Pet has the petdex gallery." keywords="pet room petdex install gallery">
            <GlassButton size="sm" onClick={() => focusSettings({ section: 'pet' })}>
              Go to Pet
            </GlassButton>
          </SettingsRow>
        )}
      </SettingsGroup>

      <SettingsGroup title="How the Room looks">
        <SettingsRow icon={<IconColorSwatch />} label="Tell pets apart by colour" description="When agents of one kind share a pet, each one wears a tint of its own." keywords="pet room tint tints colour color">
          <Toggle checked={prefs.tints} onChange={next => save({ tints: next })} label="Tell pets apart by colour" />
        </SettingsRow>
        <SettingsRow
          icon={<IconWalk />}
          label="Motion"
          description={`${motion.description} Reduce Motion always keeps the Room still.`}
          keywords="pet room motion walk calm still animation reduce"
          below={reduced ? <InlineNote tone="info">Reduce Motion is on, so the Room is still for now.</InlineNote> : undefined}
        >
          <Chips items={MOTIONS} value={prefs.motion} onChange={next => save({ motion: next })} />
        </SettingsRow>
        <SettingsRow icon={<IconBubbleText />} label="Show each step" description="A bubble says what each pet is doing, such as reading Budget.xlsx. Off leaves name tags, signs and facts." keywords="pet room bubbles steps labels">
          <Toggle checked={prefs.steps} onChange={next => save({ steps: next })} label="Show each step" />
        </SettingsRow>
        <SettingsRow
          icon={<IconFileText />}
          label="Document names on desks"
          description="The documents open in Herald Docs, Sheets and Slides and your Canvas projects stand as desks, and a pet working on one stands at its desk. Off leaves the desks unnamed."
          keywords="pet room desks documents names office canvas"
        >
          <Toggle checked={prefs.deskNames} onChange={next => save({ deskNames: next })} label="Document names on desks" />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Hermes outside Herald">
        <SettingsRow
          icon={<IconBroadcast />}
          label="Show Hermes work outside Herald"
          description="A lane at the edge of the room shows Hermes at work elsewhere: messaging bots, the Hermes CLI and TUI, Hermes's own desktop app and automations its messaging gateway runs. Coarse: titles and whether each is active, from Hermes's session list once a minute."
          keywords="pet room elsewhere outside lane telegram discord cli tui gateway sessions"
        >
          <Toggle checked={prefs.elsewhere} onChange={next => save({ elsewhere: next })} label="Show Hermes work outside Herald" />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Screensaver">
        <SettingsRow
          icon={<IconDeviceDesktop />}
          label="Show the Pet Room as the screensaver"
          description="Herald's screensaver shows the room with no names, document names or bubbles. Any key, click or move ends it, and nothing in it answers or opens. While Herald Slides presents or the pet is put away for a screen share, the clock shows instead."
          keywords="pet room screensaver screen saver idle"
          below={
            <GlassButton size="sm" variant="ghost" onClick={() => focusSettings({ section: 'general' })}>
              When the screensaver starts
            </GlassButton>
          }
        >
          <Toggle checked={prefs.screensaver} onChange={next => save({ screensaver: next })} label="Show the Pet Room as the screensaver" />
        </SettingsRow>
        <SettingsRow icon={<IconBubbleText />} label="Steps in the screensaver" description="Bubbles in the screensaver say what each pet is doing, such as reading Budget.xlsx." keywords="pet room screensaver steps bubbles labels">
          <Toggle checked={prefs.screensaverSteps} disabled={!prefs.screensaver} onChange={next => save({ screensaverSteps: next })} label="Steps in the screensaver" />
        </SettingsRow>
      </SettingsGroup>
    </>
  )
}
