import type { ImportanceLevel } from "@workspace/core"

// Maps the stored importance level (1-7) to its model.importance.* label
// sub-key. The numeric WEIGHT behind a level is internal to @workspace/core
// and never reaches the client.
export const IMPORTANCE_LABEL_KEYS = {
  7: "critical",
  6: "veryHigh",
  5: "high",
  4: "fair",
  3: "moderate",
  2: "slight",
  1: "least",
} as const satisfies Record<ImportanceLevel, string>

export function importanceLabelKey(level: number) {
  return IMPORTANCE_LABEL_KEYS[level as ImportanceLevel]
}
