"use client"

import { useTranslations } from "next-intl"
import { OrgAuditLogSection } from "@/components/org-audit-log-section"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AuditLogPage() {
  const tNav = useTranslations("dashboard.nav")
  usePageTitle(tNav("auditLog"))
  return <OrgAuditLogSection />
}
