"use client"

import { useTranslations } from "next-intl"
import { AuditLogSection } from "@/components/admin/audit-log-section"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AdminAuditLogPage() {
  const tTabs = useTranslations("dashboard.admin.tabs")
  usePageTitle(tTabs("auditLog"))
  return <AuditLogSection />
}
