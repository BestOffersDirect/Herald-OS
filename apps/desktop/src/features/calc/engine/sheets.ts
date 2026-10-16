import type { DocumentResult } from './types.ts'

/*
 * A note as spreadsheet rows for Copy to Sheets: line N is row N, the value or formula in column A
 * and its label in column B.
 */

export interface SheetRow {
  /** A number, text, or a formula starting with "=" (English function names, commas between arguments); null leaves the cell empty. */
  value: number | string | null
  /** Column B: the line's label, the name it assigns, a comment's or heading's text. */
  label: string
  /** A number format for column A when the value needs one: "#,##0.00", "0.00%", "[$USD] #,##0.00", "yyyy-mm-dd". */
  format?: string
  /** A heading: the row is bold. */
  heading?: boolean
}

/** Formulas where a line maps cleanly onto Sheets (arithmetic, percentages, splits, sums of the lines above, names used later as A-cells), values otherwise. */
export function toSheetRows(_document: DocumentResult): SheetRow[] {
  return []
}
