"use client"

import { PayMappingAnalysis } from "@/components/pay-mapping/pay-mapping-analysis"

// The Analysis section: the run's only work surface (ADR-0016). The [slug]
// layout's shell resolves the run + gap; PayMappingAnalysis reads them
// straight from that context.
export default function PayMappingAnalysisPage() {
  return <PayMappingAnalysis />
}
