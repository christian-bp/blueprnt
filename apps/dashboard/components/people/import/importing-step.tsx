"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Progress } from "@workspace/ui/components/progress"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useOrganization } from "@/components/org-context"

// How often the simulated fallback progress advances.
const TICK_MS = 150

// The importing screen's progress bar. The import action writes its real row
// counts to the importProgress table as it loops, and this component
// subscribes to them reactively. While no progress row exists yet (the
// action's setup phase) the bar eases asymptotically toward 90% as a
// fallback, so it is never frozen.
export function ImportingStep() {
  const t = useTranslations("dashboard.people.import.importing")
  const { orgId } = useOrganization()
  const progress = useQuery(api.people.importHelpers.getImportProgress, {
    orgId,
  })
  const [simulated, setSimulated] = useState(5)

  useEffect(() => {
    const id = setInterval(() => {
      setSimulated((p) => Math.min(90, p + (90 - p) * 0.06))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  const real =
    progress !== null && progress !== undefined && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : null

  return (
    <div className="flex w-full flex-col gap-2">
      <Progress
        value={real ?? simulated}
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
