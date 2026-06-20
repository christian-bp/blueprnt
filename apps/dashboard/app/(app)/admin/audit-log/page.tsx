"use client"

import { useTranslations } from "next-intl"
import { AuditLogSection } from "@/components/admin/audit-log-section"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AdminAuditLogPage() {
  const tNav = useTranslations("dashboard.nav")
  const tTabs = useTranslations("dashboard.admin.tabs")
  usePageTitle([tNav("admin"), tTabs("auditLog")])
  return <AuditLogSection />
}
