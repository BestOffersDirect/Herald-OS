import { atom } from 'nanostores'
import type { CalcRequest } from './requests.ts'

/** A request for the Calc window in this renderer (desktop mode); panels mode sends it as the window's payload. */
export const $calcRequest = atom<CalcRequest | null>(null)
