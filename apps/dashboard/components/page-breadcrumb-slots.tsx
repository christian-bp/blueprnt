"use client"

import type { ReactNode } from "react"
import { createDomSlot } from "@/components/dom-slot"

// Two places on the breadcrumb row (PageBreadcrumbRow) that a page's own
// subtree can fill: the adornment beside the trail (a concept help), and the
// aside opposite it (a standing readout).
//
// They are slots rather than props because the row is rendered by a
// persistent route layout, while what belongs in them is derived far below
// it. The kartläggning is the case: its analysis section holds the review
// queue its instrument is drawn from, and the row that should carry that
// instrument is mounted two layouts above. Passing the node down would mean
// lifting the queue into a shell that serves three other sub-pages and does
// not otherwise need it.
//
// Separate slots, not one: an adornment landing where the aside goes would be
// a bug no type could catch if both read the same target.
const adornment = createDomSlot()
const aside = createDomSlot()

// Mounted above both the header and the subtree that fills it.
export function BreadcrumbSlotProvider({ children }: { children: ReactNode }) {
  return (
    <adornment.Provider>
      <aside.Provider>{children}</aside.Provider>
    </adornment.Provider>
  )
}

// The boxes themselves, rendered by PageBreadcrumbRow. Always present and
// empty by default, so a page that fills neither renders what it always did.
export function BreadcrumbAdornmentSlot() {
  return <span className="contents" ref={adornment.useSlotRef()} />
}

export function BreadcrumbAsideSlot() {
  return <span className="contents" ref={aside.useSlotRef()} />
}

// What a page puts in them, from anywhere in its own tree.
export function BreadcrumbAdornment({ children }: { children: ReactNode }) {
  return <adornment.Content>{children}</adornment.Content>
}

export function BreadcrumbAside({ children }: { children: ReactNode }) {
  return <aside.Content>{children}</aside.Content>
}
