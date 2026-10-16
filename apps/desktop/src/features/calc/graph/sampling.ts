import type { CompiledFunction } from '../engine/types.ts'
import type { SheetPlotRef } from './types.ts'

/* Sampling functions for drawing and for Hermes's summary of a graph: pure, so it is unit-tested. */

export interface SampledCurve {
  /** Continuous pieces in order of x; a gap or an asymptote ends one. */
  segments: Array<Array<[number, number]>>
  /** The x of each vertical asymptote found. */
  asymptotes: number[]
  /** The finite y range seen; null when it had no value anywhere. */
  yRange: [number, number] | null
}

export interface FunctionSummary {
  xMin: number
  xMax: number
  yMin: number | null
  yMax: number | null
  /** Where it crosses zero. */
  zeros: number[]
  extrema: Array<{ x: number; y: number; kind: 'min' | 'max' }>
  asymptotes: number[]
  /** Ranges of x where it has no value ("sqrt(x)" below 0). */
  gaps: Array<[number, number]>
  /** A few points to quote. */
  samples: Array<[number, number]>
}

/** Points to draw `fn` between xMin and xMax, adaptively finer where it bends, split at gaps and asymptotes. */
export function sampleFunction(_fn: CompiledFunction, _xMin: number, _xMax: number, _options: { samples?: number; yView?: [number, number] } = {}): SampledCurve {
  return { segments: [], asymptotes: [], yRange: null }
}

/** What a graph of `fn` shows between xMin and xMax, in numbers. */
export function summarizeFunction(_fn: CompiledFunction, xMin: number, xMax: number): FunctionSummary {
  return { xMin, xMax, yMin: null, yMax: null, zeros: [], extrema: [], asymptotes: [], gaps: [], samples: [] }
}

/** "column B of Budget.xlsx", "B2:B40 in ~/Sales.xlsx", "Budget.xlsx column C": the cells to plot, or null. */
export function parseSheetPlot(_text: string): SheetPlotRef | null {
  return null
}
