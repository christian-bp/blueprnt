"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

// The three questions every step of the method build answers before it asks
// for anything (masterdokument section 4.1): why the reader is here, what they
// are deciding, and what the decision feeds. Three short lines rather than a
// paragraph of rationale, because the surface below is where the work happens.
//
// A description list, not headings: these are label/answer pairs, and three
// headings above a grid of four dimension headings would bury the structure
// the page is actually built on.
function FramingLine({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <dt className="font-medium text-sm">{label}</dt>
      <dd className="text-muted-foreground text-sm">{children}</dd>
    </div>
  )
}

export function BuildFraming() {
  const t = useTranslations("dashboard.model.build.framing")
  return (
    <dl className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3">
      <FramingLine label={t("whyLabel")}>{t("whyBody")}</FramingLine>
      <FramingLine label={t("decideLabel")}>{t("decideBody")}</FramingLine>
      <FramingLine label={t("nextLabel")}>{t("nextBody")}</FramingLine>
    </dl>
  )
}
