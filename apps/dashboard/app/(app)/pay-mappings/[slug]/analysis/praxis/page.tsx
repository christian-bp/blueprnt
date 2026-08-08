"use client"

import { PayMappingAnalysis } from "@/components/pay-mapping/pay-mapping-analysis"

// One chapter of the analysis, as its own page (Iteration 4). The section
// layout above carries the spine and the chapter tab row; this page carries
// only this chapter's own steps.
export default function PayMappingPraxisChapterPage() {
  return <PayMappingAnalysis chapter="praxis" />
}
