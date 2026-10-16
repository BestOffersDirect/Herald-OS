import type { GraphEntry, GraphSeries } from './types.ts'

export interface GraphViewProps {
  entries: GraphEntry[]
  series?: GraphSeries[]
  /** Values named in the note, for functions that use them ("a * x^2"). */
  scope?: Record<string, number>
  xMin?: number
  xMax?: number
  /** A small panel beside the notepad: no entry list. */
  compact?: boolean
  /** The Graph view's own editable list; left out, the entries are read-only. */
  onEntriesChange?: (entries: GraphEntry[]) => void
  className?: string
}

export function GraphView(_props: GraphViewProps) {
  return null
}
