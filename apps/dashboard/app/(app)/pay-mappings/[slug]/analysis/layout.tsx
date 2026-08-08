"use client"

import type { ReactNode } from "react"
import { AnalysisSectionShell } from "@/components/pay-mapping/analysis-section-shell"

// Thin route wrapper: the shell owns the analysis section's shared chrome
// (the spine and the chapter tab row) and this layout persists it across
// Läget and the four chapter pages, so switching chapters never re-renders
// the standing readout or flashes its skeleton. Mirrors [slug]/layout.tsx
// one level up.
export default function PayMappingAnalysisLayout({
  children,
}: {
  children: ReactNode
}) {
  return <AnalysisSectionShell>{children}</AnalysisSectionShell>
}
