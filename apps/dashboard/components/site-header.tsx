"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Fragment } from "react"
import { useOrganization } from "@/components/org-context"

// One breadcrumb. `href` set => a link to an ancestor; omitted => the current
// page. `loading` => a dynamic label that has not resolved yet; rendered as a
// fixed-size skeleton so the trail does not reflow when the name arrives.
export type Crumb = { label: string; href?: string; loading?: boolean }

// Section labels resolved by the caller (the typed next-intl translator) so
// the builder stays a plain, easily tested function.
export type BreadcrumbLabels = {
  home: string
  workOverview: string
  roles: string
  model: string
  rate: string
}

// Resolved dynamic names: a string once loaded, `undefined` while the query
// is in flight, `null` when the target does not exist.
type Names = { roleTitle?: string | null; familyName?: string | null }

// The trail is a pure function of the path and the resolved names. The
// section is the root crumb (the sidebar handles getting home), so top-level
// pages render a single current-page crumb.
export function buildBreadcrumbs(
  pathname: string,
  labels: BreadcrumbLabels,
  names: Names
): Crumb[] {
  const [section, second, third] = pathname.split("/").filter(Boolean)

  if (section === undefined) return [{ label: labels.home }]
  if (section === "model") return [{ label: labels.model }]
  if (section === "work") return [{ label: labels.workOverview }]
  if (section !== "roles") return [{ label: labels.home }]

  // Roles section and everything nested under it.
  if (second === undefined) return [{ label: labels.roles }]
  const rolesLink: Crumb = { label: labels.roles, href: "/roles" }

  // /roles/families/[familyId]
  if (second === "families") {
    if (names.familyName === null) return [{ label: labels.roles }]
    return [rolesLink, leafCrumb(names.familyName)]
  }

  // A missing role collapses to the section; the page shows its own
  // not-found message.
  if (names.roleTitle === null) return [{ label: labels.roles }]

  // /roles/[roleId]
  if (third === undefined) return [rolesLink, leafCrumb(names.roleTitle)]

  // /roles/[roleId]/rate
  if (third === "rate") {
    return [
      rolesLink,
      nameCrumb(names.roleTitle, `/roles/${second}`),
      { label: labels.rate },
    ]
  }

  // Any deeper role route we do not name explicitly stops at the role.
  return [rolesLink, leafCrumb(names.roleTitle)]
}

// A current-page crumb carrying a dynamic name (no link).
function leafCrumb(name: string | undefined): Crumb {
  return name === undefined ? { label: "", loading: true } : { label: name }
}

// A linked crumb carrying a dynamic name (an ancestor in a deeper trail).
function nameCrumb(name: string | undefined, href: string): Crumb {
  return name === undefined
    ? { label: "", href, loading: true }
    : { label: name, href }
}

export function SiteHeader() {
  const t = useTranslations("dashboard")
  const pathname = usePathname()
  const locale = useLocale()
  const { orgId } = useOrganization()

  const [section, second, third] = pathname.split("/").filter(Boolean)
  const roleId =
    section === "roles" && second !== undefined && second !== "families"
      ? second
      : undefined
  const familyId =
    section === "roles" && second === "families" ? third : undefined

  // These piggy-back on the queries the role/family pages already run (Convex
  // dedupes identical args), so naming a dynamic crumb costs no extra fetch
  // and stays reactive. "skip" keeps the hooks unconditional when off-route.
  const role = useQuery(
    api.assessment.roles.getRole,
    roleId !== undefined ? { orgId, roleId, locale } : "skip"
  )
  const families = useQuery(
    api.assessment.families.listRoleFamilies,
    familyId !== undefined ? { orgId, locale } : "skip"
  )

  const roleTitle =
    roleId === undefined ? undefined : role === null ? null : role?.title
  const familyName =
    familyId === undefined || families === undefined
      ? undefined
      : (families.find((family) => family.familyId === familyId)?.name ?? null)

  const crumbs = buildBreadcrumbs(
    pathname,
    {
      home: t("nav.home"),
      workOverview: t("nav.overview"),
      roles: t("nav.roles"),
      model: t("nav.model"),
      rate: t("breadcrumb.rate"),
    },
    { roleTitle, familyName }
  )

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
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
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1
              // Hrefs are unique within a trail and only the final crumb has
              // none, so this is a stable key without leaning on the index.
              return (
                <Fragment key={crumb.href ?? "current"}>
                  <BreadcrumbItem>
                    {crumb.loading ? (
                      <Skeleton className="h-4 w-24" />
                    ) : crumb.href === undefined ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  )
}
