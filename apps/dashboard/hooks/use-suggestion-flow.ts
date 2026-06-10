"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { SuggestionKind } from "@workspace/constants"
import { useMutation, useQuery } from "convex/react"
import type { z } from "zod"
import { useGeneratingStaleness } from "@/hooks/use-generating-staleness"
import { aiErrorSubKey } from "@/lib/error-label"

// The open-suggestion row shape every panel reads (mirrors the
// getOpenSuggestions return validator).
export interface SuggestionRow {
  suggestionId: Id<"suggestions">
  kind: string
  status: string
  suggestedValue: unknown
  errorCode: string | null
  createdAt: number
  roleId: Id<"roles"> | null
}

export type SuggestionFlowStatus =
  | "idle"
  | "generating"
  | "suggested"
  | "failed"

export interface SuggestionFlow<Value> {
  // false while the suggestions query is still loading.
  loaded: boolean
  // The newest open row of the kind (and role, when scoped), if any.
  row: SuggestionRow | undefined
  // The lifecycle state the panel renders: a generating row past the
  // staleness threshold reads as failed (retryable).
  status: SuggestionFlowStatus
  // The Zod-parsed payload when suggested; null otherwise (including a
  // malformed stored value, which renders as an empty suggestion).
  value: Value | null
  suggestionId: Id<"suggestions"> | null
  // errors.* sub-key to translate when status is "failed".
  errorSubKey: "aiUnavailable" | "aiGenerationFailed" | null
  // Dismisses the current row (no-op without one).
  reject: () => Promise<void>
}

// The read side of the AI suggestion lifecycle (ADR-0003), shared by every
// suggestion panel: kind-scoped query, newest open row, Zod re-parse of the
// stored payload across the trust boundary, staleness for crashed
// generations, and the dismiss action. Requesting and confirming stay with
// the caller: those mutations and their args are kind-specific.
export function useSuggestionFlow<Value>(options: {
  orgId: string
  kind: SuggestionKind
  schema: z.ZodType<Value>
  // Narrows to one role's suggestions (role-scoped kinds).
  roleId?: string
}): SuggestionFlow<Value> {
  const { orgId, kind, schema, roleId } = options
  const suggestions = useQuery(api.ai.suggest.getOpenSuggestions, {
    orgId,
    kind,
  })
  const rejectSuggestion = useMutation(api.ai.suggest.rejectSuggestion)

  let row: SuggestionRow | undefined
  for (const candidate of suggestions ?? []) {
    if (candidate.kind !== kind) continue
    if (roleId !== undefined && candidate.roleId !== roleId) continue
    if (row === undefined || candidate.createdAt > row.createdAt) {
      row = candidate
    }
  }

  const isStaleGenerating = useGeneratingStaleness(row)
  const parsed =
    row?.status === "suggested" ? schema.safeParse(row.suggestedValue) : null

  const status: SuggestionFlowStatus =
    row?.status === "suggested"
      ? "suggested"
      : row?.status === "failed" || isStaleGenerating
        ? "failed"
        : row?.status === "generating"
          ? "generating"
          : "idle"

  return {
    loaded: suggestions !== undefined,
    row,
    status,
    value: parsed?.success === true ? parsed.data : null,
    suggestionId: row?.suggestionId ?? null,
    errorSubKey:
      status === "failed"
        ? aiErrorSubKey(row?.status === "failed" ? (row.errorCode ?? "") : "")
        : null,
    reject: async () => {
      if (row !== undefined) {
        await rejectSuggestion({ orgId, suggestionId: row.suggestionId })
      }
    },
  }
}
