// Column auto-detection: maps raw CSV headers to canonical field keys
// using header-synonym scoring and shape-classification heuristics.

import { type CanonicalFieldKey, CANONICAL_FIELDS, fold } from "./fields.js"
import { classifyColumn } from "./shape.js"

export type DetectedMapping = {
  map: Partial<
    Record<CanonicalFieldKey, { columnIndex: number; confidence: number }>
  >
  unmappedColumns: number[]
}

/**
 * Score a raw header string against a field's synonym list.
 * Returns:
 *   1.0 — folded header exactly equals a synonym
 *   0.7 — folded header contains a synonym
 *   0.0 — no match
 */
function headerScore(raw: string, synonyms: readonly string[]): number {
  const folded = fold(raw)
  for (const syn of synonyms) {
    if (folded === syn) return 1.0
  }
  for (const syn of synonyms) {
    if (folded.includes(syn)) return 0.7
  }
  return 0
}

/**
 * Detect which canonical fields each source column corresponds to.
 *
 * Algorithm:
 *   1. For each column x field pair, compute a header score (0, 0.7, or 1.0).
 *      Boost by +0.2 (capped at 1.0) when the column's value shape matches the field's shape.
 *      Collect only non-zero header-scored candidates in the first pass.
 *   2. For each field that received NO header-scored candidate in step 1, check whether
 *      any column's shape matches and add a shape-only candidate at 0.4.
 *      This prevents shape-only guesses from displacing a field that already has a
 *      header match (spec: "shape-only when the field is unassigned").
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

  // First pass: collect header-scored candidates (hScore > 0) per field.
  const headerCandidates: Candidate[] = []
  const fieldsWithHeaderCandidate = new Set<CanonicalFieldKey>()

  for (let colIdx = 0; colIdx < numCols; colIdx++) {
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
    }
  }

  // Second pass: for fields with no header candidate, allow a shape-only candidate (score 0.4).
  // This is only emitted when the field is currently unassigned by any header match.
  const shapeCandidates: Candidate[] = []
  for (const [fIdx, field] of CANONICAL_FIELDS.entries()) {
    if (fieldsWithHeaderCandidate.has(field.key)) continue

    for (let colIdx = 0; colIdx < numCols; colIdx++) {
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
