// CSV tokenizer for the salary import engine.
// Wraps papaparse; normalizes line endings, consumes sep= directives, skips
// preamble rows, trims headers, disambiguates duplicate headers, preserves blank
// headers, strips a trailing all-empty column, pads/truncates ragged rows,
// strips null bytes, and signals single-column input. Value cells are NOT trimmed.

import Papa from "papaparse"

const UTF8_BOM = "﻿"

/**
 * Structural signals from tokenization. Always present on the result, with
 * zero/empty values when nothing was detected. Plan C reads raggedRows,
 * noDelimiter, and (via detect) blankHeaderColumns.
 */
export type TokenizeSignals = {
  /** Count of leading non-tabular rows skipped before the header row. */
  preambleRowsSkipped: number
  /** 0-based data-row indices whose original width differed from headers.length. */
  raggedRows: number[]
  /** Header names that appeared more than once (before _2/_3 disambiguation). */
  duplicateHeaders: string[]
  /** Column indices whose header cell was blank/whitespace-only. */
  blankHeaderColumns: number[]
  /** True when the file parsed as a single column (likely a missing delimiter). */
  noDelimiter: boolean
}

export type TokenizeResult = {
  headers: string[]
  rows: string[][]
  /** Structural signals, always present (zero/empty when nothing detected). */
  signals: TokenizeSignals
}

// Map a sep=<char> directive body to the actual delimiter character.
function directiveDelimiter(line: string): string | null {
  const m = /^sep=(.)$/i.exec(line)
  if (m) return m[1] ?? null
  if (/^sep=\t$/i.test(line)) return "\t"
  // Excel writes the literal word TAB in some locales.
  if (/^sep=tab$/i.test(line)) return "\t"
  return null
}

/**
 * Parse raw CSV text into headers, data rows, and structural signals.
 * Every emitted data row has exactly headers.length cells.
 */
export function tokenizeCsv(text: string): TokenizeResult {
  // 1. Strip any leading BOM(s).
  let input = text
  while (input.startsWith(UTF8_BOM)) input = input.slice(1)

  // 2. Normalize line endings: CRLF then lone CR -> LF.
  input = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  // 3. Consume a leading sep=<char> directive, if present.
  let declaredDelimiter: string | null = null
  const firstNewline = input.indexOf("\n")
  const firstLine = firstNewline === -1 ? input : input.slice(0, firstNewline)
  // trimStart only: trimEnd would swallow a trailing TAB delimiter (sep=\t).
  const sep = directiveDelimiter(firstLine.trimStart())
  if (sep !== null) {
    declaredDelimiter = sep
    input = firstNewline === -1 ? "" : input.slice(firstNewline + 1)
  }

  // 4. Parse. Use the declared delimiter only if it appears in the body (T40);
  //    otherwise auto-detect.
  const useDeclared =
    declaredDelimiter !== null && input.includes(declaredDelimiter)
  const result = Papa.parse<string[]>(input, {
    delimiter: useDeclared ? (declaredDelimiter as string) : "",
    skipEmptyLines: "greedy",
    header: false,
  })
  const allRows = result.data

  if (allRows.length === 0) {
    return {
      headers: [],
      rows: [],
      signals: {
        preambleRowsSkipped: 0,
        raggedRows: [],
        duplicateHeaders: [],
        blankHeaderColumns: [],
        noDelimiter: false,
      },
    }
  }

  // 5. Preamble skip: the header row is the first row whose cell count equals
  //    the mode of the following rows. Rows above it are preamble. Also skip a
  //    leading single-cell row that starts with "#".
  const headerRowIndex = chooseHeaderRow(allRows)
  const preambleRowsSkipped = headerRowIndex

  const rawHeader = (allRows[headerRowIndex] ?? []).map((c) => cleanCell(c))
  const rawData = allRows.slice(headerRowIndex + 1)

  // 6. Trim headers (value cells stay untrimmed).
  let headers = rawHeader.map((h) => h.trim())

  // 7. Record blank-header columns and disambiguate duplicates.
  const blankHeaderColumns: number[] = []
  headers.forEach((h, i) => {
    if (h.length === 0) blankHeaderColumns.push(i)
  })
  const { headers: dedupedHeaders, duplicateHeaders } =
    disambiguateHeaders(headers)
  headers = dedupedHeaders

  // 8. Clean value cells (null bytes) but do NOT trim.
  const cleanedData = rawData.map((row) => row.map((c) => cleanCell(c)))

  // 9. Ragged-row normalization to headers.length.
  const width = headers.length
  const raggedRows: number[] = []
  const rows: string[][] = cleanedData.map((row, i) => {
    if (row.length === width) return row
    raggedRows.push(i)
    if (row.length < width) {
      return [...row, ...Array(width - row.length).fill("")]
    }
    return row.slice(0, width)
  })

  // 10. Trailing empty column strip: last column with a blank header and all
  //     data cells empty (T18). Do not strip a blank-header column that has data.
  const stripped = stripTrailingEmptyColumn(headers, rows, blankHeaderColumns)

  // 11. Single-column / no-delimiter signal.
  const noDelimiter =
    stripped.headers.length === 1 && stripped.rows.every((r) => r.length === 1)

  return {
    headers: stripped.headers,
    rows: stripped.rows,
    signals: {
      preambleRowsSkipped,
      raggedRows,
      duplicateHeaders,
      blankHeaderColumns: stripped.blankHeaderColumns,
      noDelimiter,
    },
  }
}

// Strip null bytes from a cell. Does not trim (value parsers own trimming).
function cleanCell(c: string): string {
  return c.replace(/\0/g, "")
}

// Choose the header row index: skip a leading single-cell "#" comment row, then
// pick the first row whose cell count equals the mode of the following rows.
function chooseHeaderRow(rows: string[][]): number {
  let start = 0
  // Skip leading single-cell hash-comment rows.
  while (
    start < rows.length &&
    (rows[start]?.length ?? 0) === 1 &&
    (rows[start]?.[0] ?? "").trim().startsWith("#")
  ) {
    start++
  }

  if (start >= rows.length) return 0

  // Mode of cell counts across all rows from `start` onward.
  const counts = new Map<number, number>()
  for (let i = start; i < rows.length; i++) {
    const len = rows[i]?.length ?? 0
    counts.set(len, (counts.get(len) ?? 0) + 1)
  }
  let mode = 0
  let modeFreq = -1
  for (const [len, freq] of counts) {
    if (len <= 1) continue // never treat a single-cell row as the tabular mode
    if (freq > modeFreq || (freq === modeFreq && len > mode)) {
      mode = len
      modeFreq = freq
    }
  }
  if (mode === 0) return start // no multi-cell mode found; use first row

  for (let i = start; i < rows.length; i++) {
    if ((rows[i]?.length ?? 0) === mode) return i
  }
  return start
}

// Suffix duplicate header names (_2, _3, ...) so no two columns collapse.
function disambiguateHeaders(headers: string[]): {
  headers: string[]
  duplicateHeaders: string[]
} {
  const seen = new Map<string, number>()
  const duplicates = new Set<string>()
  const out = headers.map((h) => {
    if (h.length === 0) return h // blank headers stay blank (not disambiguated)
    const prior = seen.get(h)
    if (prior === undefined) {
      seen.set(h, 1)
      return h
    }
    const next = prior + 1
    seen.set(h, next)
    duplicates.add(h)
    return `${h}_${next}`
  })
  return { headers: out, duplicateHeaders: [...duplicates] }
}

// Strip a single trailing column whose header is blank and whose every data
// cell is empty. Re-index blankHeaderColumns after the strip.
function stripTrailingEmptyColumn(
  headers: string[],
  rows: string[][],
  blankHeaderColumns: number[]
): { headers: string[]; rows: string[][]; blankHeaderColumns: number[] } {
  const last = headers.length - 1
  if (last < 0) return { headers, rows, blankHeaderColumns }
  const headerBlank = (headers[last] ?? "").length === 0
  const allEmpty = rows.every((r) => (r[last] ?? "").trim().length === 0)
  if (!headerBlank || !allEmpty) {
    return { headers, rows, blankHeaderColumns }
  }
  return {
    headers: headers.slice(0, last),
    rows: rows.map((r) => r.slice(0, last)),
    blankHeaderColumns: blankHeaderColumns.filter((i) => i !== last),
  }
}
