// CSV tokenizer for the salary import engine.
// Wraps papaparse with auto-delimiter detection and BOM stripping.

import Papa from "papaparse"

const UTF8_BOM = "﻿"

/**
 * Parse raw CSV text into a header row and data rows.
 *
 * - Strips a leading UTF-8 BOM if present.
 * - Auto-detects the delimiter (papaparse heuristic).
 * - Drops blank and whitespace-only rows.
 * - Row 0 of the raw parse becomes `headers`; the rest become `rows`.
 * - Cell whitespace is NOT trimmed here; value parsers own that step.
 * - Quoted fields with embedded delimiters are returned as single cells.
 */
export function tokenizeCsv(text: string): {
  headers: string[]
  rows: string[][]
} {
  const input = text.startsWith(UTF8_BOM) ? text.slice(1) : text

  const result = Papa.parse<string[]>(input, {
    delimiter: "", // auto-detect
    skipEmptyLines: "greedy",
    header: false,
  })

  const [headerRow, ...dataRows] = result.data

  return {
    headers: headerRow ?? [],
    rows: dataRows,
  }
}
