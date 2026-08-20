"use client"

import type { ReactNode } from "react"
import { ModelSectionShell } from "@/components/model/model-section-shell"

// Thin route wrapper: the shell owns the model section's shared chrome (the
// spine and the chapter tab row) and this layout persists it across the four
// chapter pages, so switching chapters never re-renders the standing readout
// or flashes its skeleton. Mirrors the kartläggning analysis layout.
export default function ModelLayout({ children }: { children: ReactNode }) {
  return <ModelSectionShell>{children}</ModelSectionShell>
}
