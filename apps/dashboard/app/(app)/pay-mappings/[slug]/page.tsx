"use client"

import { PayMappingOverview } from "@/components/pay-mapping/pay-mapping-overview"
import { usePayMappingRun } from "@/components/pay-mapping/pay-mapping-run-context"

// The Overview sub-page (the run's index route): a KPI strip (gap, clock,
// flag summary) over the expandable distribution charts. The [slug] layout's
// shell resolves the gap aggregate; the widgets render their real titles and
// own their loading bars, so no page-level skeleton is needed.
export default function PayMappingOverviewPage() {
  const { gap } = usePayMappingRun()
  return <PayMappingOverview gap={gap} />
}
