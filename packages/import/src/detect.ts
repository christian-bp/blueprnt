// Column auto-detection: maps raw CSV headers to canonical field keys
// using header-synonym scoring and shape-classification heuristics.

import {
  type CanonicalFieldKey,
  CANONICAL_FIELDS,
  fold,
  matchesSynonym,
} from "./fields.js"
import { classifyColumn } from "./shape.js"

export type DetectedMapping = {
  map: Partial<
    Record<CanonicalFieldKey, { columnIndex: number; confidence: number }>
  >
  unmappedColumns: number[]
}

/**
 * Score a raw header string against a field's synonym list.
 *   1.0 — folded header exactly equals a synonym
 *   0.7 — folded header contains a synonym of at least SUBSTRING_MIN_LENGTH chars
 *   0.0 — no match
 * The minimum-length substring guard lives in matchesSynonym (fields.ts) so
 * short synonyms (e.g. removed bare "lon") never fire inside longer words.
 */
function headerScore(raw: string, synonyms: readonly string[]): number {
  const { exact, substring } = matchesSynonym(fold(raw), synonyms)
  if (exact) return 1.0
  if (substring) return 0.7
  return 0
}

// Shapes distinctive enough to assign on shape alone (no header match).
// text/id/percent are too common to earn a canonical field by shape only,
// so a text/id/percent column with no header match lands in unmappedColumns.
const SHAPE_ONLY_ELIGIBLE: ReadonlySet<string> = new Set(["gender", "boolean"])

/**
 * Detect which canonical fields each source column corresponds to.
 *
 * Algorithm:
 *   1. For each column x field pair, compute a header score (0, 0.7, or 1.0).
 *      Boost by +0.2 (capped at 1.0) when the column's value shape matches the field's shape.
 *      Collect only non-zero header-scored candidates in the first pass.
 *      Skip blank-header columns entirely (they go straight to unmappedColumns).
 *      Track every column that produced a header candidate for use in pass 2.
 *   2. For each field that received NO header-scored candidate in step 1, check whether
 *      any column's shape matches and add a shape-only candidate at 0.4.
 *      Restricted to distinctive shapes (gender/boolean): text/id/percent columns never
 *      earn a field by shape alone (DC-09, DC-12, DC-21).
 *      Columns that produced a header candidate (runner-up synonym losers) are excluded
 *      from this pass so they are not re-stolen into another field (DC-10, SC-14, SC-25).
 *      Blank-header columns are also excluded (DC-22, ENC-16).
 *   3. Assign greedily by descending score: one column per field, one field per column.
 *      Tie-break: score desc, then field index in CANONICAL_FIELDS asc (required fields
 *      win over optional on equal score), then column index asc (reproducible, not V8-stable).
 *   4. Remaining columns go to unmappedColumns.
 */
export function detectColumns(input: {
  headers: string[]
  rows: string[][]
}): DetectedMapping {
  const { headers, rows } = input
  const numCols = headers.length

  // Sample up to 20 rows per column for shape classification.
  const sample = rows.slice(0, 20)

  // Build a candidate list: { fieldKey, fieldIndex, columnIndex, score }
  type Candidate = {
    fieldKey: CanonicalFieldKey
    fieldIndex: number
    columnIndex: number
    score: number
  }

  // Pre-compute shape for each column once (avoids re-classifying in the second pass).
  const colShapes: string[] = Array.from({ length: numCols }, (_, colIdx) => {
    const colValues = sample.map((row) => row[colIdx] ?? "")
    return classifyColumn(colValues).shape
  })

  // Columns whose folded header is empty are always unmapped (DC-22, ENC-16).
  const blankHeaderCols = new Set<number>()
  for (let colIdx = 0; colIdx < numCols; colIdx++) {
    if (fold(headers[colIdx] ?? "").length === 0) blankHeaderCols.add(colIdx)
  }

  // First pass: collect header-scored candidates (hScore > 0) per field.
  const headerCandidates: Candidate[] = []
  const fieldsWithHeaderCandidate = new Set<CanonicalFieldKey>()
  const headerCandidateCols = new Set<number>()

  for (let colIdx = 0; colIdx < numCols; colIdx++) {
    if (blankHeaderCols.has(colIdx)) continue
    for (const [fIdx, field] of CANONICAL_FIELDS.entries()) {
      const hScore = headerScore(headers[colIdx] ?? "", field.synonyms)
      if (hScore === 0) continue

      const shapesMatch = colShapes[colIdx] === field.shape
      const score = shapesMatch ? Math.min(1.0, hScore + 0.2) : hScore
      headerCandidates.push({
        fieldKey: field.key,
        fieldIndex: fIdx,
        columnIndex: colIdx,
        score,
      })
      fieldsWithHeaderCandidate.add(field.key)
      headerCandidateCols.add(colIdx)
    }
  }

  // Second pass: shape-only candidates (score 0.4) for fields with no header
  // candidate. Restricted to distinctive shapes (gender/boolean); text/id/percent
  // never earn a field by shape alone (DC-09, DC-12, DC-21). A column that already
  // produced a header candidate (a runner-up synonym loser) is excluded so it is
  // not re-stolen into another field (DC-10, SC-14, SC-25). Blank-header columns
  // are excluded (DC-22, ENC-16).
  const shapeCandidates: Candidate[] = []
  for (const [fIdx, field] of CANONICAL_FIELDS.entries()) {
    if (fieldsWithHeaderCandidate.has(field.key)) continue
    if (!SHAPE_ONLY_ELIGIBLE.has(field.shape)) continue

    for (let colIdx = 0; colIdx < numCols; colIdx++) {
      if (blankHeaderCols.has(colIdx)) continue
      if (headerCandidateCols.has(colIdx)) continue
      if (colShapes[colIdx] === field.shape) {
        shapeCandidates.push({
          fieldKey: field.key,
          fieldIndex: fIdx,
          columnIndex: colIdx,
          score: 0.4,
        })
      }
    }
  }

  const candidates: Candidate[] = [...headerCandidates, ...shapeCandidates]

  // Sort: score desc, then field index asc (required fields win ties), then column index asc
  // (deterministic; does not rely on V8 sort stability).
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.fieldIndex - b.fieldIndex ||
      a.columnIndex - b.columnIndex
  )

  const assignedFields = new Set<CanonicalFieldKey>()
  const assignedCols = new Set<number>()
  const map: DetectedMapping["map"] = {}

  for (const { fieldKey, columnIndex, score } of candidates) {
    if (assignedFields.has(fieldKey) || assignedCols.has(columnIndex)) continue
    map[fieldKey] = { columnIndex, confidence: score }
    assignedFields.add(fieldKey)
    assignedCols.add(columnIndex)
  }

  const unmappedColumns: number[] = []
  for (let i = 0; i < numCols; i++) {
    if (!assignedCols.has(i)) unmappedColumns.push(i)
  }

  return { map, unmappedColumns }
}
