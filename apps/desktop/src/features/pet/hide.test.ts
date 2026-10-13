import { describe, expect, it } from 'vitest'
import { autoHideReason, fullscreenInFront, petHiddenWhy, type VisibilityInput, type WindowLike } from './hide.ts'

describe('petHiddenWhy', () => {
  const shown: VisibilityInput = { enabled: true, installed: true, hidden: false, fullscreen: false, presenting: false, doNotDisturb: false }
  const everything: VisibilityInput = { enabled: false, installed: false, hidden: true, fullscreen: true, presenting: true, doNotDisturb: true }

  it('shows the pet when nothing hides it', () => {
    expect(petHiddenWhy(shown)).toBeNull()
  })

  it('names the first reason: off, none installed, put away, presenting, full screen, Do Not Disturb', () => {
    expect(petHiddenWhy(everything)).toBe('off')
    expect(petHiddenWhy({ ...everything, enabled: true })).toBe('none')
    expect(petHiddenWhy({ ...everything, enabled: true, installed: true })).toBe('hidden')
    expect(petHiddenWhy({ ...everything, enabled: true, installed: true, hidden: false })).toBe('presenting')
    expect(petHiddenWhy({ ...shown, fullscreen: true, doNotDisturb: true })).toBe('fullscreen')
    expect(petHiddenWhy({ ...shown, doNotDisturb: true })).toBe('doNotDisturb')
  })
})

describe('autoHideReason', () => {
  it('steps aside for a presentation, then full screen, then Do Not Disturb', () => {
    expect(autoHideReason({ fullscreen: true, presenting: true, doNotDisturb: true })).toBe('presenting')
    expect(autoHideReason({ fullscreen: true, presenting: false, doNotDisturb: true })).toBe('fullscreen')
    expect(autoHideReason({ fullscreen: false, presenting: false, doNotDisturb: true })).toBe('doNotDisturb')
    expect(autoHideReason({ fullscreen: false, presenting: false, doNotDisturb: false })).toBeNull()
  })
})

describe('fullscreenInFront', () => {
  const output = { width: 1920, height: 1080 }
  const win = (extra: Partial<WindowLike>): WindowLike => ({ title: 'Firefox', workspaceId: 1, floating: false, layout: { width: 960, height: 1000 }, ...extra })

  it('sees a window on the focused workspace that says it is full screen', () => {
    expect(fullscreenInFront([win({}), win({ fullscreen: true })], 1, output)).toBe(true)
    expect(fullscreenInFront([win({ fullscreen: true, floating: true, layout: null })], 1, output)).toBe(true)
    expect(fullscreenInFront([win({ fullscreen: true, workspaceId: 2 })], 1, output)).toBe(false)
  })

  it('sees a tiled window that covers the output, within 2 px', () => {
    expect(fullscreenInFront([win({ layout: { width: 1920, height: 1080 } })], 1, output)).toBe(true)
    expect(fullscreenInFront([win({ layout: { width: 1918, height: 1078 } })], 1, output)).toBe(true)
    expect(fullscreenInFront([win({ layout: { width: 1917, height: 1080 } })], 1, output)).toBe(false)
    expect(fullscreenInFront([win({ layout: { width: 1920, height: 966 } })], 1, output)).toBe(false)
    expect(fullscreenInFront([win({ floating: true, layout: { width: 1920, height: 1080 } })], 1, output)).toBe(false)
  })

  it('skips the pet’s own window, and sees nothing without a focused workspace', () => {
    const own = win({ title: 'Herald OS · Pet', fullscreen: true })

    expect(fullscreenInFront([own], 1, output, ['Herald OS · Pet'])).toBe(false)
    expect(fullscreenInFront([own], 1, output)).toBe(true)
    expect(fullscreenInFront([win({ fullscreen: true })], null, output)).toBe(false)
  })
})
