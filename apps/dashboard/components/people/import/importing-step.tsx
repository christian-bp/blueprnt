"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Progress } from "@workspace/ui/components/progress"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useOrganization } from "@/components/org-context"

// The importing screen's loading state: a spinner (the action is working)
// above a progress bar that only ever shows REAL row counts, written by the
// import action to the importProgress table and read reactively. The bar
// stays at 0 during the action's setup phase and holds its last value when
// the progress row is cleared at completion (the wizard swaps to the done
// screen a moment later).
export function ImportingStep() {
  const t = useTranslations("dashboard.people.import.importing")
  const { orgId } = useOrganization()
  const progress = useQuery(api.people.importHelpers.getImportProgress, {
    orgId,
  })
  const [pct, setPct] = useState(0)

  useEffect(() => {
    if (progress !== null && progress !== undefined && progress.total > 0) {
      const next = Math.round((progress.processed / progress.total) * 100)
      // The server counts are monotonic; the max is a safety net so the bar
      // can never move backwards.
      setPct((p) => Math.max(p, next))
    }
  }, [progress])

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        {/* Decorative: the Progress element carries the accessible state. */}
        <Spinner aria-hidden="true" className="text-brand" />
        <span className="text-muted-foreground text-sm">{t("working")}</span>
      </div>
      <Progress
        value={pct}
        aria-label={t("title")}
        data-testid="import-progress"
      />
      {/* Fixed-height slot: the count appearing must not shift the layout. */}
      <p
        className="min-h-5 text-center text-muted-foreground text-sm"
        data-testid="import-progress-count"
      >
        {progress !== null && progress !== undefined
          ? t("progressCount", {
              processed: progress.processed,
              total: progress.total,
            })
          : null}
      </p>
    </div>
  )
}
