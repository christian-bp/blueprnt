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
 *   0.7 — folded header contains or starts with a synonym
 *   0.0 — no match
 */
function headerScore(raw: string, synonyms: readonly string[]): number {
  const folded = fold(raw)
  for (const syn of synonyms) {
    if (folded === syn) return 1.0
  }
  for (const syn of synonyms) {
    if (folded.includes(syn) || folded.startsWith(syn)) return 0.7
  }
  return 0
}

/**
 * Detect which canonical fields each source column corresponds to.
 *
 * Algorithm:
 *   1. For each column, compute a header score (0, 0.7, or 1.0) against every field's synonyms.
 *   2. Classify the column's shape from up to 20 sample rows.
 *   3. Score(field, col) = headerScore boosted +0.2 when shapes match (capped at 1.0);
 *      if headerScore is 0 but shape matches and the field is still unassigned, use 0.4.
 *   4. Assign greedily by descending score: one column per field, one field per column.
 *   5. Remaining columns go to unmappedColumns.
 */
export function detectColumns(input: {
  headers: string[]
  rows: string[][]
}): DetectedMapping {
  const { headers, rows } = input
  const numCols = headers.length

  // Sample up to 20 rows per column for shape classification.
  const sample = rows.slice(0, 20)

  // Build a candidate list: { fieldKey, columnIndex, score }
  type Candidate = {
    fieldKey: CanonicalFieldKey
    columnIndex: number
    score: number
  }

  const candidates: Candidate[] = []

  for (let colIdx = 0; colIdx < numCols; colIdx++) {
    const colValues = sample.map((row) => row[colIdx] ?? "")
    const shapeResult = classifyColumn(colValues)
    const colShape = shapeResult.shape

    for (const field of CANONICAL_FIELDS) {
      const hScore = headerScore(headers[colIdx] ?? "", field.synonyms)
      const shapesMatch = colShape === field.shape

      let score: number
      if (hScore > 0) {
        score = shapesMatch ? Math.min(1.0, hScore + 0.2) : hScore
      } else if (shapesMatch) {
        // Shape-only candidate: allowed at 0.4 when field is not otherwise claimed.
        score = 0.4
      } else {
        continue
      }

      candidates.push({ fieldKey: field.key, columnIndex: colIdx, score })
    }
  }

  // Sort descending by score so greediest wins come first.
  candidates.sort((a, b) => b.score - a.score)

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
