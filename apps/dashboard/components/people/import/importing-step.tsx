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
// fallback. The shown value is a RATCHET: the simulated drift stops the
// moment real data exists, and real percentages only ever push the bar up,
// so the handover from simulated to real can never move the bar backwards.
export function ImportingStep() {
  const t = useTranslations("dashboard.people.import.importing")
  const { orgId } = useOrganization()
  const progress = useQuery(api.people.importHelpers.getImportProgress, {
    orgId,
  })
  const [shown, setShown] = useState(2)
  const hasReal = progress !== null && progress !== undefined

  // Simulated drift, only while the action has not reported real counts yet.
  // It eases toward a LOW ceiling: the setup phase it stands in for is a
  // small slice of the work, and any fake value above the first real report
  // would freeze the ratcheted bar there, overstating progress.
  useEffect(() => {
    if (hasReal) return
    const id = setInterval(() => {
      setShown((p) => Math.min(10, p + (10 - p) * 0.05))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [hasReal])

  // Real counts ratchet the bar upward; a real percentage below what is
  // already shown just pauses the bar until reality catches up.
  useEffect(() => {
    if (progress !== null && progress !== undefined && progress.total > 0) {
      const pct = Math.round((progress.processed / progress.total) * 100)
      setShown((p) => Math.max(p, pct))
    }
  }, [progress])

  return (
    <div className="flex w-full flex-col gap-2">
      <Progress
        value={shown}
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
