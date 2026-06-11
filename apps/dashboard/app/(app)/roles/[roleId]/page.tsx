"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { use } from "react"
import { MorphConfirmButton } from "@/components/morph-confirm-button"
import { useOrganization } from "@/components/org-context"
import { AnchorRoleCard } from "@/components/roles/anchor-role-card"
import { RoleProfileCard } from "@/components/roles/role-profile-card"
import { RoleRatingCard } from "@/components/roles/role-rating-card"
import { RoleResultCard } from "@/components/roles/role-result-card"
import { RoleStatusActions } from "@/components/roles/role-status-actions"
import { statusBadgeVariant } from "@/lib/role-status"

export default function RolePage(props: {
  params: Promise<{ roleId: string }>
}) {
  const { roleId } = use(props.params)
  const t = useTranslations("dashboard.roles.detail")
  const tArchive = useTranslations("dashboard.roles.archive")
  const tStatus = useTranslations("assessment.status")
  const { orgId, role: orgRole } = useOrganization()
  const router = useRouter()
  const archiveRole = useMutation(api.assessment.roles.archiveRole)
  const locale = useLocale()
  const role = useQuery(api.assessment.roles.getRole, {
    orgId,
    roleId,
    locale,
  })

  if (role === undefined) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("profileHeading")} />
      </main>
    )
  }
  if (role === null) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">{t("notFound")}</p>
        <Link href="/roles" className="text-sm underline underline-offset-4">
          {t("backToRoles")}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-medium text-lg">{role.title}</h2>
        <Badge variant={statusBadgeVariant(role.status)}>
          {tStatus(role.status as "draft" | "inReview" | "approved")}
        </Badge>
        {role.archived && <Badge variant="outline">{t("archivedBadge")}</Badge>}
        <span className="text-muted-foreground text-sm">
          {role.trackName} · {role.function} · {role.team}
        </span>
        {orgRole === "admin" && (
          <MorphConfirmButton
            className="ml-auto"
            triggerLabel={tArchive("cta")}
            confirmLabel={tArchive("confirm")}
            cancelLabel={tArchive("cancel")}
            onConfirm={async () => {
              await archiveRole({ orgId, roleId: role.roleId })
              router.push("/roles")
            }}
          />
        )}
      </div>
      {/* Archived roles turn read-only everywhere (edit, AI draft, rating);
          state the consequence once instead of letting controls vanish
          silently (guidance convention). */}
      {role.archived && (
        <p className="text-muted-foreground text-sm">{t("archivedHint")}</p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* The AI draft assistant lives in the profile card's header (a
              MorphPopover next to Edit), not as a separate card. */}
          <RoleProfileCard orgId={orgId} role={role} />
        </div>
        <div className="space-y-6">
          <RoleRatingCard
            roleId={role.roleId}
            status={role.status}
            archived={role.archived}
            profileComplete={role.profileComplete}
            ratedCount={role.ratedCount}
            totalCriteria={role.totalCriteria}
          />
          <RoleStatusActions
            orgId={orgId}
            roleId={role.roleId}
            status={role.status}
            canComplete={
              role.profileComplete &&
              role.totalCriteria > 0 &&
              role.ratedCount === role.totalCriteria
            }
          />
          <RoleResultCard orgId={orgId} roleId={roleId} />
          <AnchorRoleCard
            orgId={orgId}
            roleId={role.roleId}
            anchorRole={role.anchorRole}
            assessmentComplete={
              role.totalCriteria > 0 && role.ratedCount === role.totalCriteria
            }
            archived={role.archived}
          />
        </div>
      </div>
    </div>
  )
}
