"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useOrganization } from "@/components/org-context"
import { OrganizationLogoSection } from "@/components/organization/organization-logo-section"
import { OrganizationProfileForm } from "@/components/organization/organization-profile-form"
import { PseudonymizeSection } from "@/components/organization/pseudonymize-section"
import { PageHeader } from "@/components/page-header"
import { usePageTitle } from "@/hooks/use-page-title"

export default function OrganizationGeneralPage() {
  const tTabs = useTranslations("dashboard.organization.tabs")
  const t = useTranslations("dashboard.organization.general")
  usePageTitle(tTabs("general"))
  const { orgId } = useOrganization()
  const settings = useQuery(api.accounts.organization.getOrganizationSettings, {
    orgId,
  })

  return (
    <div className="space-y-6">
      <PageHeader title={tTabs("general")} description={t("description")} />
      <OrganizationLogoSection imageUrl={settings?.imageUrl ?? null} />
      {settings !== undefined && (
        <>
          <OrganizationProfileForm
            initial={{
              country: settings.country,
              currency: settings.currency,
              language: settings.language,
              industry: settings.industry,
            }}
          />
          <PseudonymizeSection pseudonymizeNames={settings.pseudonymizeNames} />
        </>
      )}
    </div>
  )
}
