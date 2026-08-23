"use client"

import type { ReactNode } from "react"

// One bordered section inside an inner-sidebar footer. Each block carries
// its own top border (never the footer slot: a slot with a border of its own
// would draw an empty strip whenever every block has nothing to say), so
// stacked blocks separate themselves and a footer with no content renders
// nothing visible at all.
export function SidebarFooterBlock({ children }: { children: ReactNode }) {
  return <div className="border-border border-t pt-1 pb-2">{children}</div>
}
