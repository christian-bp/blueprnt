"use client"

import NumberFlow from "@number-flow/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useOrganization } from "@/components/org-context"
import { WizardProgress } from "@/components/wizard-progress"

// The importing screen's loading state: a spinner (the action is working)
// above a progress bar that only ever shows REAL row counts, written by the
// import action to the importProgress table and read reactively. WizardProgress
// owns the percentage derivation and the monotonic clamp: feeding it 0/0
// while progress is null (the setup phase, and the moment the row is cleared
// at completion) holds the bar at its last value rather than snapping back.
export function ImportingStep({ importId }: { importId: string }) {
  const t = useTranslations("dashboard.people.import.importing")
  const { orgId } = useOrganization()
  // Scoped to THIS run: a stale progress row from an earlier (e.g.
  // abandoned) import returns null instead of leaking into the bar.
  const progress = useQuery(api.people.importHelpers.getImportProgress, {
    orgId,
    importId,
  })

  return (
    <WizardProgress
      done={progress?.processed ?? 0}
      total={progress?.total ?? 0}
      label={t("working")}
      countLabel={
        progress !== null && progress !== undefined
          ? // A running readout, so the figures roll digit-by-digit rather
            // than swapping. The connective and the unit stay inside the
            // message (Finnish writes "12/40 rivia", not "12 of 40"), so the
            // numbers are tagged rather than concatenated around a component.
            t.rich("progressCount", {
              processed: () => <NumberFlow value={progress.processed} />,
              total: () => <NumberFlow value={progress.total} />,
            })
          : undefined
      }
      testId="import-progress"
    />
  )
}
