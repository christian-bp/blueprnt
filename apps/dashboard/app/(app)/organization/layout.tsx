"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { useOrganization } from "@/components/org-context"

// Admin-only surface. The nav entry is admin-gated and the backend re-checks,
// but a direct visit by an editor lands here, so gate authoritatively in the UI
// too. The tab bar lives in the site header (OrganizationTabs); this layout
// provides the narrow column that constrains the page content width.
export default function OrganizationLayout(props: { children: ReactNode }) {
  const t = useTranslations("dashboard.organization")
  const { role } = useOrganization()
  if (role !== "admin") {
    return (
      <div className="w-full">
        <p className="text-muted-foreground text-sm">{t("notAuthorized")}</p>
      </div>
    )
  }
  return <div className="w-full">{props.children}</div>
}
