"use client"

import { PayMappingSummary } from "@/components/pay-mapping/pay-mapping-summary"

// The Analysis section: the run's steady-state summary (ADR-0012), not the
// guided wizard (that moved to the full-screen takeover at the sibling
// /review route). The [slug] layout's shell resolves the run + gap;
// PayMappingSummary reads them straight from that context.
export default function PayMappingAnalysisPage() {
  return <PayMappingSummary />
}
