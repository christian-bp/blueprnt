// CSV tokenizer for the salary import engine.
// Wraps papaparse; normalizes line endings, consumes sep= directives, skips
// preamble rows, trims headers, disambiguates duplicate headers, preserves blank
// headers, strips a trailing all-empty column, pads/truncates ragged rows,
// strips null bytes, and signals single-column input. Value cells are NOT trimmed.

import Papa from "papaparse"

const UTF8_BOM = "﻿"

/**
 * Thrown by tokenizeCsv when the input is a binary spreadsheet, not CSV.
 * This is the engine's only throwing path (a wrong-format file is not a value
 * to parse). The wizard maps it to the invalidFileFormat blocking code and
 * shows "export as CSV" (Plan C consumes { kind, signature }).
 */
export class ImportFormatError extends Error {
  readonly kind = "binary" as const
  readonly signature: "zip" | "ole2"

  constructor(signature: "zip" | "ole2", message?: string) {
    super(
      message ??
        `Binary spreadsheet input detected (${signature}); export as CSV`
    )
    this.name = "ImportFormatError"
    this.signature = signature
  }
}

// Leading code units of known binary spreadsheet signatures.
// ZIP local-file header PK\x03\x04 covers XLSX and ODS; its bytes are ASCII
// printable so the signature survives File.text() (UTF-8 decode) intact.
// OLE2 compound-file magic covers legacy XLS; this detection is effective only
// when the input was decoded as Latin-1 or binary (the literal byte sequence
// 0xD0 0xCF 0xE1 0xA1 0xB1 0xA1 maps to those Unicode code points under
// Latin-1). When File.text() decodes the file as UTF-8, the high bytes yield
// replacement characters (U+FFFD) and the OLE2 branch will NOT fire.
// OLE2 detection via ArrayBuffer sniffing is deferred to the consumer layer.
const ZIP_SIGNATURE = "PK\x03\x04"
const OLE2_SIGNATURE = "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1"

function detectBinarySignature(text: string): "zip" | "ole2" | null {
  if (text.startsWith(ZIP_SIGNATURE)) return "zip"
  if (text.startsWith(OLE2_SIGNATURE)) return "ole2"
  return null
}

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
  // Excel writes the literal word TAB in some locales.
  if (/^sep=tab$/i.test(line)) return "\t"
  return null
}

/**
 * Parse raw CSV text into headers, data rows, and structural signals.
 * Every emitted data row has exactly headers.length cells.
 */
export function tokenizeCsv(text: string): TokenizeResult {
  // Binary-signature guard: reject binary spreadsheets before any parsing.
  const binary = detectBinarySignature(text)
  if (binary !== null) throw new ImportFormatError(binary)

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

/**
 * Suffix duplicate header names (_2, _3, ...) so no two columns share a name.
 *
 * Guarantee: the returned headers array contains NO duplicate non-blank names.
 * When generating a suffix for a duplicate, the counter is incremented until
 * the candidate name is not already used by any column (original or
 * already-assigned), so an explicit column named "salary_2" in the source will
 * not collide with a disambiguated duplicate.
 * Blank headers are left as-is and are never disambiguated.
 */
function disambiguateHeaders(headers: string[]): {
  headers: string[]
  duplicateHeaders: string[]
} {
  // Build the full set of all names that appear in the original header list
  // (excluding blanks). This prevents us from assigning a suffixed name that
  // already exists as an original column.
  const allOriginalNames = new Set<string>(headers.filter((h) => h.length > 0))
  // Track names that have already been assigned in the output so far.
  const assignedNames = new Set<string>()
  const seen = new Map<string, number>()
  const duplicates = new Set<string>()
  const out = headers.map((h) => {
    if (h.length === 0) return h // blank headers stay blank (not disambiguated)
    if (!assignedNames.has(h)) {
      // First occurrence: claim it.
      seen.set(h, 1)
      assignedNames.add(h)
      return h
    }
    // Duplicate: find the next suffix that is not already taken by any column
    // (original or already-assigned).
    duplicates.add(h)
    let counter = (seen.get(h) ?? 1) + 1
    while (
      allOriginalNames.has(`${h}_${counter}`) ||
      assignedNames.has(`${h}_${counter}`)
    ) {
      counter++
    }
    seen.set(h, counter)
    const suffixed = `${h}_${counter}`
    assignedNames.add(suffixed)
    return suffixed
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
