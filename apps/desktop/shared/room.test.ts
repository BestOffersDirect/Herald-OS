import { describe, expect, it } from 'vitest'
import { mergeRoomPrefs, normalizeRoomPrefs, ROOM_KINDS, ROOM_PREFS_DEFAULTS } from './room.ts'

describe('normalizeRoomPrefs', () => {
  it('reads the defaults from nothing, or from something that is not an object', () => {
    for (const raw of [undefined, null, 'full', 42, true, ['boba']]) {
      expect(normalizeRoomPrefs(raw)).toEqual(ROOM_PREFS_DEFAULTS)
    }
  })

  it('keeps the pet chosen for each kind of work on its own', () => {
    const prefs = normalizeRoomPrefs({ pets: { conversation: 'boba', helper: ' mochi ' } })

    expect(prefs.pets).toEqual({ conversation: 'boba', mission: null, helper: 'mochi', automation: null })
    expect(Object.keys(prefs.pets).sort()).toEqual([...ROOM_KINDS].sort())
  })

  it('drops keys it does not know, at the top and among the pets', () => {
    const prefs = normalizeRoomPrefs({ pets: { mission: 'boba', robot: 'mochi' }, colour: 'red', motion: 'calm' })

    expect(prefs).toEqual({ ...ROOM_PREFS_DEFAULTS, pets: { ...ROOM_PREFS_DEFAULTS.pets, mission: 'boba' }, motion: 'calm' })
    expect(prefs).not.toHaveProperty('colour')
    expect(prefs.pets).not.toHaveProperty('robot')
  })

  it('takes only one folder name for a pet: never a path, a dot-folder, an empty name or anything but text', () => {
    for (const slug of ['../boba', 'pets/boba', 'pets\\boba', '.boba', '..', '', '   ', 42, { slug: 'boba' }, ['boba'], true]) {
      expect(normalizeRoomPrefs({ pets: { conversation: slug } }).pets.conversation, String(slug)).toBeNull()
    }

    expect(normalizeRoomPrefs({ pets: { conversation: 'cosmo-cat_2' } }).pets.conversation).toBe('cosmo-cat_2')
  })

  it('takes only a motion it knows', () => {
    expect(normalizeRoomPrefs({ motion: 'still' }).motion).toBe('still')
    expect(normalizeRoomPrefs({ motion: 'calm' }).motion).toBe('calm')

    for (const motion of ['walk', 'FULL', '', 1, null]) {
      expect(normalizeRoomPrefs({ motion }).motion, String(motion)).toBe('full')
    }
  })

  it('turns tints and step bubbles off only with false', () => {
    expect(normalizeRoomPrefs({ tints: false, steps: false })).toMatchObject({ tints: false, steps: false })
    expect(normalizeRoomPrefs({ tints: 'no', steps: 0 })).toMatchObject({ tints: true, steps: true })
  })
})

describe('mergeRoomPrefs', () => {
  const current = { ...ROOM_PREFS_DEFAULTS, pets: { ...ROOM_PREFS_DEFAULTS.pets, conversation: 'boba', helper: 'mochi' }, motion: 'calm' as const }

  it('changes only the fields a patch names', () => {
    expect(mergeRoomPrefs(current, { steps: false })).toEqual({ ...current, steps: false })
    expect(mergeRoomPrefs(current, { motion: 'still', tints: false })).toEqual({ ...current, motion: 'still', tints: false })
  })

  it('changes the pets kind by kind, and null hands a kind back to the Room to pick', () => {
    expect(mergeRoomPrefs(current, { pets: { mission: 'boba' } }).pets).toEqual({ conversation: 'boba', mission: 'boba', helper: 'mochi', automation: null })
    expect(mergeRoomPrefs(current, { pets: { helper: null } }).pets).toEqual({ ...current.pets, helper: null })
  })

  it('leaves a field given as undefined as it was', () => {
    expect(mergeRoomPrefs(current, { motion: undefined, pets: { conversation: undefined } })).toEqual(current)
  })

  it('makes the result whole whatever it is given', () => {
    expect(mergeRoomPrefs(undefined, undefined)).toEqual(ROOM_PREFS_DEFAULTS)
    expect(mergeRoomPrefs(current, 'calm')).toEqual(current)
    expect(mergeRoomPrefs({ pets: { conversation: '../boba' }, motion: 'warp' }, { pets: 'boba', extra: 1 })).toEqual(ROOM_PREFS_DEFAULTS)
  })
})
