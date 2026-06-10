"use client"

import { useEffect, useState } from "react"

// A crashed generation action never reaches markFailed, so a "generating"
// suggestion row can linger forever. Rows older than this are treated as
// failed and retryable by every AI panel.
export const STALE_AFTER_MS = 90_000

// Re-evaluation cadence while a generating row exists; no interval runs
// otherwise (no busy-waiting).
const TICK_MS = 10_000

// Shared staleness check for the AI suggestion panels: ticks a re-render
// every 10s while the given row is generating and reports whether it has
// crossed the retryable threshold.
export function useGeneratingStaleness(
  row: { status: string; createdAt: number } | undefined
): boolean {
  const isGenerating = row?.status === "generating"
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isGenerating) return
    const id = setInterval(() => setTick((n) => n + 1), TICK_MS)
    return () => clearInterval(id)
  }, [isGenerating])
  return (
    row?.status === "generating" && Date.now() - row.createdAt >= STALE_AFTER_MS
  )
}
