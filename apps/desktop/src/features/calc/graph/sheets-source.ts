import type { GraphSeries, SheetPlotRef } from './types.ts'

/* Points from Herald Sheets, for an open workbook or a closed file. */

/** The numbers in a sheet's cells as points (x is their position); throws a plain message when it cannot. */
export async function readSheetSeries(_ref: SheetPlotRef): Promise<GraphSeries> {
  throw new Error('Reading sheets is not ready yet')
}
