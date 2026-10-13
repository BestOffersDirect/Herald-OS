import { BrowserWindow, ipcMain } from 'electron'
import fs from 'node:fs/promises'
import { IPC } from '../../shared/ipc.ts'
import { PET_IDLE_SNAPSHOT, PET_OFF, type PetInfo, type PetSnapshot } from '../../shared/pet.ts'
import { hermesHome } from '../paths.ts'
import { petSheetPath, readPetInfo, signature } from './config.ts'
import { petWorkArea, type PetWindow } from './window.ts'

/** How often main looks for changes to Hermes's pet settings and its pets folder. */
const POLL_MS = 4000
/** The largest spritesheet main hands to a window. */
const MAX_SHEET_BYTES = 32 * 1024 * 1024

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export interface PetIpcOptions {
  /** The window that works out what the pet shows: the desktop window, or the panels 'main' surface. */
  hermesWindow: () => BrowserWindow | null
  /** Panels mode: the pet's own window. */
  petWindow: PetWindow | null
  home?: () => string
}

/**
 * The pet in main: Hermes's pet settings, read again whenever their files change and sent to every
 * window; the spritesheets; and in panels mode the relay between the Hermes window and the pet
 * window, which alone may place, show or give the keys to itself.
 */
export function registerPetIpc({ hermesWindow, petWindow, home = hermesHome }: PetIpcOptions): void {
  let info: PetInfo = PET_OFF
  let sheet: string | null = null
  let stamp = ''
  let snapshot: PetSnapshot | null = null
  let publisher: number | null = null

  // The signature is taken before reading, so a change made while reading is caught next time.
  const reload = () => {
    stamp = signature(home(), sheet)
    const next = readPetInfo(home())
    sheet = next.slug ? petSheetPath(next.slug, home()) : null

    if (JSON.stringify(next) === JSON.stringify(info)) {
      return
    }

    info = next
    petWindow?.follow(info)

    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.petInfoChanged, info)
    }
  }
  const check = () => {
    if (signature(home(), sheet) !== stamp) {
      reload()
    }
  }
  const sendSnapshot = () => {
    if (snapshot) {
      petWindow?.send(IPC.petSnapshot, snapshot)
    }
  }

  reload()
  setInterval(check, POLL_MS).unref()
  petWindow?.onLoad(sendSnapshot)

  ipcMain.handle(IPC.petInfo, () => {
    check()

    return info
  })
  ipcMain.handle(IPC.petRefresh, () => {
    reload()

    return info
  })
  ipcMain.handle(IPC.petSheet, async (_event, slug: unknown): Promise<Uint8Array | null> => {
    const file = typeof slug === 'string' ? petSheetPath(slug, home()) : null

    if (!file) {
      return null
    }

    try {
      const { size } = await fs.stat(file)

      return size <= MAX_SHEET_BYTES ? new Uint8Array(await fs.readFile(file)) : null
    } catch {
      return null
    }
  })

  ipcMain.on(IPC.petPublish, (event, next: unknown) => {
    if (!isRecord(next) || event.sender.id !== hermesWindow()?.webContents.id) {
      return
    }

    snapshot = next as unknown as PetSnapshot
    sendSnapshot()

    if (publisher !== event.sender.id) {
      const id = event.sender.id
      publisher = id
      // Without the Hermes window nothing works out what the pet shows: it rests rather than freeze mid-reaction.
      event.sender.once('destroyed', () => {
        if (publisher === id) {
          publisher = null
          snapshot = null
          petWindow?.send(IPC.petSnapshot, PET_IDLE_SNAPSHOT)
        }
      })
    }
  })
  ipcMain.on(IPC.petAct, (event, action: unknown) => {
    if (petWindow?.owns(event.sender) && isRecord(action) && typeof action.type === 'string') {
      hermesWindow()?.webContents.send(IPC.petAction, action)
    }
  })
  ipcMain.on(IPC.petReplay, (event, kind: unknown) => {
    if (!petWindow?.owns(event.sender)) {
      return
    }

    if (kind === 'cover') {
      petWindow.replayCover()
    } else {
      sendSnapshot()
    }
  })

  ipcMain.handle(IPC.petPlace, (event, placement: unknown) => (petWindow?.owns(event.sender) ? petWindow.place(placement) : undefined))
  ipcMain.handle(IPC.petInteractive, (event, on: unknown) => (petWindow?.owns(event.sender) ? petWindow.setInteractive(on === true) : undefined))
  ipcMain.handle(IPC.petVisible, (event, on: unknown) => (petWindow?.owns(event.sender) ? petWindow.setVisible(on === true) : undefined))
  ipcMain.handle(IPC.petWorkArea, () => petWorkArea())
}
