"use client"

import { Progress } from "@workspace/ui/components/progress"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

// How often the simulated progress advances.
const TICK_MS = 150

// The importing screen's progress bar. importPayroll is a single server
// action with no progress events, so the bar eases asymptotically toward 90%
// while the action runs; on success the wizard navigates away, on failure it
// returns to the review step, so the bar never needs to reach 100 here.
export function ImportingStep() {
  const t = useTranslations("dashboard.people.import.importing")
  const [progress, setProgress] = useState(5)

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => Math.min(90, p + (90 - p) * 0.06))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <Progress
      value={progress}
      aria-label={t("title")}
      data-testid="import-progress"
    />
  )
}
