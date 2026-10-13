import { app, BrowserWindow, screen, type WebContents } from 'electron'
import { IPC, type WmState } from '../../shared/ipc.ts'
import { type PetCover, type PetInfo, type PetRect, petShown, type PetWindowPlacement } from '../../shared/pet.ts'
import { FLOATING_APPS, SURFACE_TITLE } from '../shell/mode.ts'
import type { PanelShell } from '../shell/panels.ts'

/*
 * Panels mode: the pet is a window of its own, small, transparent and floating, which niri never
 * focuses as it opens (linux/niri/config.kdl). Its renderer draws the pet and says where the window
 * goes; main sizes it, moves it through niri, and hands the keys back whenever niri gives them to
 * it while it takes none (focus follows the mouse in Herald's niri, and a click focuses too).
 */

export const PET_TITLE = SURFACE_TITLE.pet
const SLIDES_TITLE = FLOATING_APPS.slides.title
/** Herald Slides' audience window, as electron/office/presenter.ts titles it. */
export const AUDIENCE_TITLE = 'Herald Slides Audience'
/** The longest side the pet window may have: Hermes's largest pet with its bubble beside it fits. */
const MAX_SIDE = 2000

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** A placement from the pet window in whole pixels, with a sensible size; null when it is not one. */
export function placementOf(value: unknown): PetWindowPlacement | null {
  const { x, y, width, height } = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>

  if (!finite(x) || !finite(y) || !finite(width) || !finite(height)) {
    return null
  }

  const side = (length: number) => Math.min(MAX_SIDE, Math.max(1, Math.round(length)))

  return { x: Math.round(x), y: Math.round(y), width: side(width), height: side(height) }
}

/** What Herald's own windows cover: one of them full screen, Herald Slides presenting. */
export function coverOf(windows: ReadonlyArray<{ title: string; fullscreen: boolean }>): PetCover {
  const others = windows.filter(win => win.title !== PET_TITLE)

  return {
    fullscreen: others.some(win => win.fullscreen),
    presenting: others.some(win => win.title === AUDIENCE_TITLE || (win.title === SLIDES_TITLE && win.fullscreen))
  }
}

/** The window to give the keys back to when the pet has them and takes none; null to leave them. */
export function bounceTarget(state: WmState, petId: number | null, interactive: boolean, back: number | null): number | null {
  return petId !== null && !interactive && state.focusedWindowId === petId && back !== null && back !== petId ? back : null
}

/**
 * The area the pet moves in, in the output's logical pixels: the whole primary display, the menu
 * bar's top 30 and the Dock's bottom 84 included (niri's struts in linux/niri/config.kdl keep tiles
 * off them, not floating windows); the renderer keeps the pet clear of both itself.
 */
export function petWorkArea(): PetRect {
  const { width, height } = screen.getPrimaryDisplay().bounds

  return { x: 0, y: 0, width, height }
}

/**
 * Runs one job at a time and keeps only the latest one asked for meanwhile: a drag moves the pet
 * many times a second, and only where it ends up matters. Each push resolves once its value, or a
 * later one that replaced it, has been applied.
 */
export class Latest<T> {
  private next: { value: T } | null = null
  private waiting: Array<() => void> = []
  private running = false

  constructor(private readonly run: (value: T) => Promise<void>) {}

  push(value: T): Promise<void> {
    this.next = { value }
    const done = new Promise<void>(resolve => this.waiting.push(resolve))

    if (!this.running) {
      void this.drain()
    }

    return done
  }

  private async drain(): Promise<void> {
    this.running = true

    while (this.next) {
      const { value } = this.next
      const waiting = this.waiting
      this.next = null
      this.waiting = []

      try {
        await this.run(value)
      } catch {
        // A failed job is dropped; the next one tries again.
      }

      for (const resolve of waiting) {
        resolve()
      }
    }

    this.running = false
  }
}

/** The pet's window in panels mode: open while Hermes shows a pet, placed where its renderer asks. */
export class PetWindow {
  private info: PetInfo | null = null
  private started = false
  private interactive = false
  private attached: BrowserWindow | null = null
  /** Put back each time niri maps the window again: a hidden window is unmapped, and shown under a new id. */
  private placement: PetWindowPlacement | null = null
  private nativeId: number | null = null
  private focusedId: number | null = null
  private cover: PetCover = { fullscreen: false, presenting: false }
  private readonly htmlFullScreen = new Set<number>()
  private readonly loadListeners = new Set<() => void>()
  private readonly moves = new Latest<PetWindowPlacement>(placement => this.apply(placement))

  constructor(private readonly shell: PanelShell) {}

  start(): void {
    if (this.started) {
      return
    }

    this.started = true
    this.shell.wm.onState(state => this.followCompositor(state))

    for (const win of BrowserWindow.getAllWindows()) {
      this.watchCover(win)
    }

    app.on('browser-window-created', (_event, win) => this.watchCover(win))

    if (this.info) {
      this.follow(this.info)
    }
  }

  /** Open the pet window while Hermes shows a pet, close it once it does not. */
  follow(info: PetInfo): void {
    this.info = info

    if (!this.started) {
      return
    }

    if (!petShown(info)) {
      this.shell.close('pet')

      return
    }

    this.shell.open('pet')
    const win = this.window()

    if (win && win !== this.attached) {
      this.attach(win)
    }
  }

  window(): BrowserWindow | null {
    return this.shell.surfaceWindow('pet')
  }

  owns(sender: WebContents): boolean {
    return this.window()?.webContents.id === sender.id
  }

  send(channel: string, payload: unknown): void {
    this.window()?.webContents.send(channel, payload)
  }

  /** Each time the pet window has loaded, a reload included. */
  onLoad(listener: () => void): void {
    this.loadListeners.add(listener)
  }

  replayCover(): void {
    this.send(IPC.petCover, this.cover)
  }

  place(value: unknown): Promise<void> {
    const placement = placementOf(value)

    if (!placement) {
      return Promise.resolve()
    }

    this.placement = placement

    return this.moves.push(placement)
  }

  /** Only while its chat box is open does the pet take the keys; then they go back where they were. */
  async setInteractive(on: boolean): Promise<void> {
    this.interactive = on
    const win = this.window()

    if (!win) {
      return
    }

    win.setFocusable(on)

    if (on) {
      const id = await this.niriId()

      if (id !== null) {
        await this.focus(id)
      }

      return
    }

    const state = this.shell.wm.state()
    const back = bounceTarget(state, this.shell.wm.ourWindow(PET_TITLE)?.id ?? null, false, this.shell.lastAppWindow(state))

    if (back !== null) {
      await this.focus(back)
    }
  }

  async setVisible(on: boolean): Promise<void> {
    const win = this.window()

    if (!win) {
      return
    }

    if (on) {
      if (!win.isVisible()) {
        win.showInactive()
      }

      return
    }

    if (this.interactive) {
      await this.setInteractive(false)
    }

    win.hide()
  }

  private attach(win: BrowserWindow): void {
    this.attached = win
    win.webContents.on('did-finish-load', () => {
      this.replayCover()

      for (const listener of this.loadListeners) {
        listener()
      }
    })
    win.on('closed', () => {
      if (this.attached === win) {
        this.attached = null
        this.interactive = false
        this.placement = null
        this.nativeId = null
      }
    })
  }

  private followCompositor(state: WmState): void {
    const pet = state.windows.find(w => w.ours && w.title === PET_TITLE) ?? null

    if (pet && pet.id !== this.nativeId && this.placement) {
      void this.moves.push(this.placement)
    }

    this.nativeId = pet?.id ?? null

    // Once as the keys arrive: a window that will not take them back is not asked again and again.
    if (state.focusedWindowId !== this.focusedId) {
      this.focusedId = state.focusedWindowId
      const back = bounceTarget(state, this.nativeId, this.interactive, this.shell.lastAppWindow(state))

      if (back !== null) {
        void this.focus(back)
      }
    }

    this.updateCover()
  }

  private async apply(placement: PetWindowPlacement): Promise<void> {
    const win = this.window()

    if (!win) {
      return
    }

    const [width, height] = win.getSize()

    if (width !== placement.width || height !== placement.height) {
      // niri holds a Wayland window to its size hints, so they move with every new size.
      win.setMinimumSize(placement.width, placement.height)
      win.setMaximumSize(placement.width, placement.height)
      win.setSize(placement.width, placement.height)
    }

    const id = await this.niriId()

    if (id !== null) {
      await this.shell.wm.moveFloatingWindow(id, placement.x, placement.y)
    }
  }

  /** niri learns about a window a moment after Electron creates or shows it. */
  private async niriId(): Promise<number | null> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const win = this.shell.wm.ourWindow(PET_TITLE)

      if (win) {
        return win.id
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return null
  }

  private focus(id: number): Promise<void> {
    return this.shell.wm.action({ type: 'focus-window', id }).catch(() => undefined)
  }

  private watchCover(win: BrowserWindow): void {
    const id = win.id
    const update = () => this.updateCover()
    win.on('enter-full-screen', update)
    win.on('leave-full-screen', update)
    win.on('enter-html-full-screen', () => {
      this.htmlFullScreen.add(id)
      update()
    })
    win.on('leave-html-full-screen', () => {
      this.htmlFullScreen.delete(id)
      update()
    })
    // Electron may still list the window while its 'closed' listeners run.
    win.on('closed', () => {
      this.htmlFullScreen.delete(id)
      setImmediate(update)
    })
    setImmediate(update)
  }

  private updateCover(): void {
    const next = coverOf(
      BrowserWindow.getAllWindows()
        .filter(win => !win.isDestroyed())
        .map(win => ({ title: win.getTitle(), fullscreen: this.htmlFullScreen.has(win.id) || win.isFullScreen() }))
    )

    if (next.fullscreen !== this.cover.fullscreen || next.presenting !== this.cover.presenting) {
      this.cover = next
      this.replayCover()
    }
  }
}
