import { CALC_KEYPADS, type CalcKeypad } from '../../../shared/calc.ts'
import type { GraphRequest, GraphSeries } from './graph/types.ts'

/* What opens Herald Calc on something: a command, voice, Hermes, another app. */

export type CalcView = 'notes' | 'keypad' | 'graph' | 'history'
export const CALC_VIEWS: readonly CalcView[] = ['notes', 'keypad', 'graph', 'history']

export interface CalcRequest {
  view?: CalcView
  keypad?: CalcKeypad
  /** Start a new note with this text. */
  text?: string
  /** Draw these in the Graph view. */
  plot?: GraphRequest
  /** Show the history searched for this. */
  search?: string
  /** When it was asked; a window acts on each request once. */
  at: number
}

const MAX_POINTS = 20_000

/** A request from a window payload, checked field by field; null when it holds none. */
export function readCalcRequest(payload: unknown): CalcRequest | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  const source = payload as Record<string, unknown>

  if (typeof source.at !== 'number' || !Number.isFinite(source.at)) {
    return null
  }

  const request: CalcRequest = { at: source.at }

  if (CALC_VIEWS.includes(source.view as CalcView)) {
    request.view = source.view as CalcView
  }

  if (CALC_KEYPADS.includes(source.keypad as CalcKeypad)) {
    request.keypad = source.keypad as CalcKeypad
  }

  if (typeof source.text === 'string' && source.text.trim()) {
    request.text = source.text
  }

  if (typeof source.search === 'string') {
    request.search = source.search
  }

  const plot = readPlot(source.plot)

  if (plot) {
    request.plot = plot
  }

  return request
}

function readPlot(raw: unknown): GraphRequest | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }

  const source = raw as Record<string, unknown>
  const entries = Array.isArray(source.entries) ? source.entries.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '') : []
  const series = Array.isArray(source.series) ? source.series.map(readSeries).filter((entry): entry is GraphSeries => entry !== null) : []
  const plot: GraphRequest = {}

  if (entries.length) {
    plot.entries = entries
  }

  if (series.length) {
    plot.series = series
  }

  if (typeof source.xMin === 'number' && typeof source.xMax === 'number' && Number.isFinite(source.xMin) && Number.isFinite(source.xMax) && source.xMin < source.xMax) {
    plot.xMin = source.xMin
    plot.xMax = source.xMax
  }

  return plot.entries || plot.series ? plot : null
}

function readSeries(raw: unknown): GraphSeries | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const source = raw as Record<string, unknown>
  const points = Array.isArray(source.points)
    ? source.points
        .slice(0, MAX_POINTS)
        .filter((point): point is [number, number] => Array.isArray(point) && point.length === 2 && point.every(value => typeof value === 'number' && Number.isFinite(value)))
    : []

  return points.length ? { label: typeof source.label === 'string' ? source.label : 'Data', points } : null
}
