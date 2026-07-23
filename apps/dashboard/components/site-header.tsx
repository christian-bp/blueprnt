"use client"

import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { AccountTabs } from "@/components/account/account-tabs"
import { AdminTabs } from "@/components/admin/admin-tabs"
import { ModelTabs } from "@/components/model/model-tabs"
import { OrganizationTabs } from "@/components/organization/organization-tabs"
import { PayMappingRunIndicator } from "@/components/pay-mapping/pay-mapping-run-indicator"
import { PayMappingTabs } from "@/components/pay-mapping/pay-mapping-tabs"
import { PeopleTabs } from "@/components/people/people-tabs"
import { SectionTabs } from "@/components/section-tabs"

export function SiteHeader() {
  const t = useTranslations("dashboard")
  const pathname = usePathname()

  const segments = pathname.split("/").filter(Boolean)
  const [section] = segments

  // The header carries the section identity: the Work section (/work, /roles),
  // the Admin, Model, and People sections get switchable tabs; the other
  // top-level sections get a plain title. Inside one kartläggning
  // (/pay-mappings/<slug>...) the header owns the whole workspace chrome:
  // the per-run tabs and the run switcher on the right (identity + the way
  // between runs and back to the list); the pay-mappings LIST keeps the
  // plain header (the tabs belong to a run). The Analysis sub-page is now
  // the guided review journey (ADR-0012), which owns its own in-page
  // progress chrome instead of a second header row.
  const inWorkSection = section === "work" || section === "roles"
  const inAdminSection = section === "admin"
  const inModelSection = section === "model"
  const inPeopleSection = section === "people"
  const inAccountSection = section === "account"
  const inOrganizationSection = section === "organization"
  const inPayMappingRun = section === "pay-mappings" && segments.length >= 2
  const sectionTitle = t("nav.home")

  return (
    <header className="flex h-(--header-height) w-full shrink-0 items-center gap-1 border-b px-4 transition-[width,height] ease-linear lg:gap-2 lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        // The vendored separator sizes its vertical variant with
        // data-vertical:self-stretch; with our fixed h-4 (a definite cross
        // size) that resolves to align-self:flex-start and pins the divider
        // to the top of the row. Re-center it with the matching variant so
        // it stays a 16px centered rule.
        className="mx-2 data-[orientation=vertical]:h-4 data-vertical:self-center"
      />
      {inWorkSection ? (
        <SectionTabs />
      ) : inAdminSection ? (
        <AdminTabs />
      ) : inModelSection ? (
        <ModelTabs />
      ) : inPeopleSection ? (
        <PeopleTabs />
      ) : inAccountSection ? (
        <AccountTabs />
      ) : inOrganizationSection ? (
        <OrganizationTabs />
      ) : inPayMappingRun ? (
        <PayMappingTabs />
      ) : (
        <span className="font-medium text-sm">{sectionTitle}</span>
      )}
      {inPayMappingRun && <PayMappingRunIndicator />}
    </header>
  )
}
