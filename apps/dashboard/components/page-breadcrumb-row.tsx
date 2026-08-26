"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { type Crumb, PageBreadcrumb } from "@/components/page-breadcrumb"
import {
  BreadcrumbAdornmentSlot,
  BreadcrumbAsideSlot,
} from "@/components/page-breadcrumb-slots"

// Every page's first row: the breadcrumb trail standing in for the page title
// (the last segment IS the title; an sr-only h1 carries it for assistive
// tech), with the page's own actions right-aligned on the same line. min-h-9
// reserves the height whether or not actions are present, so pages with and
// without them start their content at the same y.
export function PageBreadcrumbRow({
  segments,
  adornment,
  actions,
}: {
  // A stage label leading the trail, on the row the page already has. It sits
  // before the trail rather than above it because this row IS the page's
  // heading: a second line would be a second heading row on every page that
  // carries one.
  // WITHOUT the Home crumb; the row prepends it (Hem -> "/") except on the
  // home page itself, where the single segment already is the front door.
  segments: Crumb[]
  // A concept's HelpMorphButton, right after the trail (the last segment is
  // the title the help anchors to).
  adornment?: ReactNode
  actions?: ReactNode
}) {
  const t = useTranslations("dashboard")
  const home: Crumb = { label: t("nav.home"), href: "/" }
  const atHome = segments.length === 0
  const trail = atHome ? [{ label: t("nav.home") }] : [home, ...segments]
  const last = trail.at(-1)
  const title = last !== undefined && "label" in last ? last.label : undefined
  return (
    // items-START on the row, with each side centering inside its own
    // min-h-9 strip: the trail's distance from the header must be identical
    // on every page, and with the row itself centering, a page whose aside is
    // taller than the strip (the sections carrying their journey instrument
    // here) pushed its crumbs a few pixels lower than every other page's.
    // Tall content now grows downward from the same first line instead.
    <header
      data-slot="page-breadcrumb-row"
      className="flex min-h-9 w-full shrink-0 items-start justify-between gap-2"
    >
      {title !== undefined && <h1 className="sr-only">{title}</h1>}
      {/* The adornment slot puts a concept's HelpMorphButton right after the
          trail's last segment (the help-after-title rule); the aside slot is
          how a layout-rendered row receives its page's own instrument (the
          analysis journey's progress). Both are empty spans when unfilled. */}
      <div className="flex min-h-9 min-w-0 items-center gap-1.5">
        <PageBreadcrumb segments={trail} />
        {adornment}
        <BreadcrumbAdornmentSlot />
      </div>
      <div className="flex min-h-9 shrink-0 items-center gap-2">
        {actions}
        <BreadcrumbAsideSlot />
      </div>
    </header>
  )
}
