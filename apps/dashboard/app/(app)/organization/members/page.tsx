"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useOrganization } from "@/components/org-context"
import { InviteMemberDialog } from "@/components/organization/invite-member-dialog"
import { OrganizationMembersSection } from "@/components/organization/organization-members-section"
import { PageHeader } from "@/components/page-header"
import { usePageTitle } from "@/hooks/use-page-title"

export default function OrganizationMembersPage() {
  const tTabs = useTranslations("dashboard.organization.tabs")
  const t = useTranslations("dashboard.organization.members")
  usePageTitle(tTabs("members"))
  const { orgId } = useOrganization()
  // The invite control lives in the page header; bumping this nonce refetches
  // the pending-invitations list after a new invite is sent.
  const [inviteNonce, setInviteNonce] = useState(0)
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <InviteMemberDialog
            orgId={orgId}
            onInvited={() => setInviteNonce((n) => n + 1)}
          />
        }
      />
      <OrganizationMembersSection refreshKey={inviteNonce} />
    </div>
  )
}
