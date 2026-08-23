"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useOrganization } from "@/components/org-context"
import { OrganizationLogoSection } from "@/components/organization/organization-logo-section"
import { OrganizationProfileForm } from "@/components/organization/organization-profile-form"
import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"
import { usePageTitle } from "@/hooks/use-page-title"

export default function OrganizationGeneralPage() {
  const tTabs = useTranslations("dashboard.organization.tabs")
  const tNav = useTranslations("dashboard.nav")
  usePageTitle(tTabs("general"))
  const { orgId } = useOrganization()
  const settings = useQuery(api.accounts.organization.getOrganizationSettings, {
    orgId,
  })

  return (
    <div className="space-y-6">
      <PageBreadcrumbRow
        segments={[{ label: tNav("settings") }, { label: tTabs("general") }]}
      />
      <OrganizationLogoSection imageUrl={settings?.imageUrl ?? null} />
      {settings !== undefined && (
        <OrganizationProfileForm
          initial={{
            country: settings.country,
            currency: settings.currency,
            language: settings.language,
            industry: settings.industry,
          }}
        />
      )}
    </div>
  )
}
