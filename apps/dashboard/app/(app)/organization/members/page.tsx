"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useOrganization } from "@/components/org-context"
import { InviteMemberDialog } from "@/components/organization/invite-member-dialog"
import { OrganizationMembersSection } from "@/components/organization/organization-members-section"
import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"
import { usePageTitle } from "@/hooks/use-page-title"

export default function OrganizationMembersPage() {
  const tTabs = useTranslations("dashboard.organization.tabs")
  const tNav = useTranslations("dashboard.nav")
  usePageTitle(tTabs("members"))
  const { orgId } = useOrganization()
  // The invite control lives in the page header; bumping this nonce refetches
  // the pending-invitations list after a new invite is sent.
  const [inviteNonce, setInviteNonce] = useState(0)
  return (
    <div className="space-y-4">
      <PageBreadcrumbRow
        segments={[{ label: tNav("settings") }, { label: tTabs("members") }]}
      />
      <OrganizationMembersSection
        refreshKey={inviteNonce}
        toolbar={
          <InviteMemberDialog
            orgId={orgId}
            onInvited={() => setInviteNonce((n) => n + 1)}
          />
        }
      />
    </div>
  )
}
