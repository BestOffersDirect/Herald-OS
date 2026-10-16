import type { DocumentResult } from '../engine/types.ts'

/** A new workbook in Herald Sheets from a note: formulas where they map, values otherwise, labels beside them. Resolves to a line for a toast. */
export async function copyToSheets(_document: DocumentResult, _name: string): Promise<string> {
  throw new Error('Copy to Sheets is not ready yet')
}

/** A new document in Herald Docs with a note as a neat table. Resolves to a line for a toast. */
export async function copyToDocs(_document: DocumentResult, _name: string): Promise<string> {
  throw new Error('Copy to Docs is not ready yet')
}
