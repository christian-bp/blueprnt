"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { use } from "react"
import { type Crumb, PageBreadcrumb } from "@/components/page-breadcrumb"
import { useOrganization } from "@/components/org-context"
import { TrackBadge } from "@/components/track-badge"
import { RoleActionsMenu } from "@/components/roles/role-actions-menu"
import { AnchorRoleCard } from "@/components/roles/anchor-role-card"
import { RoleProfileCard } from "@/components/roles/role-profile-card"
import { RoleRatingCard } from "@/components/roles/role-rating-card"
import { RoleResultCard } from "@/components/roles/role-result-card"
import { usePageTitle } from "@/hooks/use-page-title"

export default function RolePage(props: {
  params: Promise<{ roleSlug: string }>
}) {
  const { roleSlug } = use(props.params)
  const t = useTranslations("dashboard.roles.detail")
  const tNav = useTranslations("dashboard.nav")
  const { orgId, role: orgRole } = useOrganization()
  const locale = useLocale()
  const role = useQuery(api.assessment.roles.getRoleBySlug, {
    orgId,
    slug: roleSlug,
    locale,
  })
  usePageTitle(role?.title)

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

  const roleCrumbs: Crumb[] = [{ label: tNav("roles"), href: "/roles" }]
  if (role.familyName !== null && role.familySlug !== null) {
    roleCrumbs.push({
      label: role.familyName,
      href: `/roles/families/${role.familySlug}`,
    })
  }
  roleCrumbs.push({ label: role.title })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <PageBreadcrumb segments={roleCrumbs} />
          {role.archived && (
            <Badge variant="outline">{t("archivedBadge")}</Badge>
          )}
          <TrackBadge trackKey={role.trackKey} name={role.trackName} />
          <span className="text-muted-foreground text-sm">
            {role.function} · {role.team}
          </span>
        </div>
        <RoleActionsMenu
          orgId={orgId}
          roleId={role.roleId}
          archived={role.archived}
          isAdmin={orgRole === "admin"}
        />
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
            slug={role.slug}
            archived={role.archived}
            profileComplete={role.profileComplete}
            ratedCount={role.ratedCount}
            totalCriteria={role.totalCriteria}
          />
          <RoleResultCard orgId={orgId} roleId={role.roleId} />
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
