"use client"

import { useTranslations } from "next-intl"
import { UsersSection } from "@/components/admin/users-section"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AdminUsersPage() {
  const tNav = useTranslations("dashboard.nav")
  const tTabs = useTranslations("dashboard.admin.tabs")
  usePageTitle([tNav("admin"), tTabs("users")])
  return <UsersSection />
}
