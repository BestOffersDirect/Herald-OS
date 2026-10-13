import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizePetPrefs, PET_OFF, type PetInfo } from '../../shared/pet.ts'
import { $petInfo } from '../features/pet/info.ts'
import { $petChatRequest, $petSnapshot } from '../features/pet/transport.ts'
import { matchIntent } from '../lib/voice/intents.ts'
import { $prefs } from '../store/backend.ts'
import { COMMAND_ID, type CommandContext, defineCommands, resetCommands } from '../store/os-commands.ts'
import { commandGroups } from './index.ts'
import { petCommands } from './pet.ts'

// The stores read the preload bridge and the viewport when they load; tests run without a DOM.
vi.hoisted(() => {
  const prefs = { current: {} as Record<string, unknown> }
  Object.assign(globalThis, {
    window: {
      innerWidth: 1440,
      innerHeight: 900,
      heraldOS: { prefs: { set: async (patch: Record<string, unknown>) => (prefs.current = { ...prefs.current, ...patch }) } }
    },
    document: { documentElement: { dataset: {}, style: { setProperty: () => undefined, removeProperty: () => undefined } } }
  })
})

const hermes = vi.hoisted(() => ({ select: vi.fn(), enable: vi.fn(), scale: vi.fn() }))

vi.mock('../features/pet/actions.ts', async importOriginal => {
  const original = await importOriginal<typeof import('../features/pet/actions.ts')>()

  return { ...original, selectPet: hermes.select, setPetEnabled: hermes.enable, setPetScale: hermes.scale }
})

const UI: CommandContext = { source: 'ui' }
const INSTALLED: PetInfo = { ...PET_OFF, enabled: true, slug: 'teknium', displayName: 'Teknium', revision: '1:2', mime: 'image/webp', installed: [{ slug: 'boba', displayName: 'Boba' }, { slug: 'teknium', displayName: 'Teknium' }] }

function command(id: string) {
  const found = petCommands.find(entry => entry.id === id)

  if (!found) {
    throw new Error(`no command ${id}`)
  }

  return found
}

const petPrefs = () => normalizePetPrefs($prefs.get().pet)

describe('the pet commands', () => {
  beforeEach(() => {
    $petInfo.set(INSTALLED)
    $prefs.set({ ...$prefs.get(), pet: normalizePetPrefs(undefined) })
    $petSnapshot.set({ ...$petSnapshot.get(), activity: 'idle', step: null, badge: 0, hiddenBy: null })
    hermes.select.mockReset().mockImplementation(async (slug: string) => ({ ...INSTALLED, slug, displayName: slug }))
    hermes.enable.mockReset().mockResolvedValue(INSTALLED)
    hermes.scale.mockReset().mockImplementation(async (scale: number) => ({ ...INSTALLED, scale }))
  })

  afterEach(() => {
    $petInfo.set(PET_OFF)
  })

  it('use ids the registry accepts, and no optional argument declares choices', () => {
    for (const entry of petCommands) {
      expect(COMMAND_ID.test(entry.id), entry.id).toBe(true)

      for (const arg of entry.args) {
        expect(!arg.required && arg.enum, `${entry.id} ${arg.name}`).toBeFalsy()
      }
    }
  })

  it('put the pet away and bring it back', async () => {
    expect((await command('pet.hide').run({}, UI)).ok).toBe(true)
    expect(petPrefs().hidden).toBe(true)

    expect((await command('pet.toggle').run({}, UI)).summary).toBe('Showing Teknium')
    expect(petPrefs().hidden).toBe(false)

    await command('pet.toggle').run({}, UI)
    expect(petPrefs().hidden).toBe(true)

    expect((await command('pet.show').run({}, UI)).ok).toBe(true)
    expect(petPrefs().hidden).toBe(false)
    expect(hermes.enable).not.toHaveBeenCalled()
  })

  it('switch the pet on in Hermes when showing a pet that is off', async () => {
    $petInfo.set({ ...INSTALLED, enabled: false })

    expect((await command('pet.show').run({}, UI)).ok).toBe(true)
    expect(hermes.enable).toHaveBeenCalledWith(true)
  })

  it('send the person to the gallery when no pet is installed', async () => {
    $petInfo.set(PET_OFF)

    expect((await command('pet.show').run({}, UI)).ok).toBe(false)
    expect((await command('pet.enable').run({ enabled: true }, UI)).ok).toBe(false)
    expect((await command('pet.status').run({}, UI)).summary).toMatch(/No pet is installed/)
    expect(hermes.enable).not.toHaveBeenCalled()
  })

  it('choose a pet by its name, or install one by its petdex slug', async () => {
    expect((await command('pet.select').run({ name: 'the Boba pet' }, UI)).ok).toBe(true)
    expect(hermes.select).toHaveBeenLastCalledWith('boba')

    expect((await command('pet.select').run({ name: 'cosmo-cat' }, UI)).ok).toBe(true)
    expect(hermes.select).toHaveBeenLastCalledWith('cosmo-cat')

    expect((await command('pet.select').run({ name: 'a big orange cat' }, UI)).ok).toBe(false)
    expect(hermes.select).toHaveBeenCalledTimes(2)
  })

  it('say what the pet is doing, or why it is away', async () => {
    $petSnapshot.set({ ...$petSnapshot.get(), activity: 'running', step: 'Editing Q3 report', badge: 2 })
    expect((await command('pet.status').run({}, UI)).summary).toBe('Teknium is running a tool: Editing Q3 report, with 2 running in the background')

    $petSnapshot.set({ ...$petSnapshot.get(), hiddenBy: 'presenting' })
    expect((await command('pet.status').run({}, UI)).summary).toMatch(/while Herald Slides presents/)

    await command('pet.hide').run({}, UI)
    expect((await command('pet.status').run({}, UI)).summary).toMatch(/put away/)

    $petInfo.set({ ...INSTALLED, enabled: false })
    expect((await command('pet.status').run({}, UI)).summary).toBe('Teknium is switched off in Hermes')
  })

  it('switch the pet off and resize it through Hermes', async () => {
    expect((await command('pet.enable').run({ enabled: false }, UI)).summary).toBe('Switched the pet off')
    expect(hermes.enable).toHaveBeenCalledWith(false)

    expect((await command('pet.size').run({ scale: 0.5 }, UI)).summary).toBe("The pet's size is now 0.5")
    expect(hermes.scale).toHaveBeenCalledWith(0.5)
  })

  it('list the installed pets and the one in use', async () => {
    const result = await command('pet.list').run({}, UI)

    expect(result.summary).toBe('Installed pets: Boba, Teknium')
    expect(result.items).toEqual([
      { slug: 'boba', displayName: 'Boba', active: false },
      { slug: 'teknium', displayName: 'Teknium', active: true }
    ])
  })

  it('open the chat bubble only while the pet is on screen', async () => {
    const before = $petChatRequest.get()

    expect((await command('pet.chat').run({}, UI)).ok).toBe(true)
    expect($petChatRequest.get()).toBe(before + 1)

    await command('pet.hide').run({}, UI)
    expect((await command('pet.chat').run({}, UI)).ok).toBe(false)
    expect($petChatRequest.get()).toBe(before + 1)
  })
})

describe('the pet on the voice fast path', () => {
  beforeEach(() => {
    resetCommands()
    defineCommands(Object.values(commandGroups).flat())
  })

  it('matches the pet phrases against the whole catalogue', () => {
    expect(matchIntent('hide the pet')).toMatchObject({ command: 'pet.hide' })
    expect(matchIntent('Hey Hermes, put the pet away')).toMatchObject({ command: 'pet.hide' })
    expect(matchIntent('show the pet')).toMatchObject({ command: 'pet.show' })
    expect(matchIntent('bring back the pet')).toMatchObject({ command: 'pet.show' })
    expect(matchIntent('turn off the pet')).toMatchObject({ command: 'pet.enable', args: { enabled: false } })
    expect(matchIntent('turn the pet on')).toMatchObject({ command: 'pet.enable', args: { enabled: true } })
    expect(matchIntent('what is the pet doing')).toMatchObject({ command: 'pet.status' })
    expect(matchIntent('use the boba pet')).toMatchObject({ command: 'pet.select', args: { name: 'boba' } })
  })
})
