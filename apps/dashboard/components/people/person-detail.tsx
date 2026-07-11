"use client"

import {
  InformationCircleIcon,
  MoreHorizontalIcon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { AddSalaryDialog } from "@/components/people/add-salary-dialog"
import {
  PayComparisonSection,
  PayComparisonSectionSkeleton,
} from "@/components/people/pay-comparison-section"
import { PersonActionsMenu } from "@/components/people/person-actions-menu"
import { SalaryRowActions } from "@/components/people/salary-row-actions"
import { useOrganization } from "@/components/org-context"
import { type Crumb, PageBreadcrumb } from "@/components/page-breadcrumb"
import { PageHeader } from "@/components/page-header"
import { useMoney } from "@/hooks/use-money"
import { usePageTitle } from "@/hooks/use-page-title"

// The salary list's loading state: the same stacked-item wrappers as the
// loaded list (year + role lines left, total + basic lines right, the row
// menu as its real muted icon), with bars centered in each text line box so
// the rows measure identical to loaded ones.
function SalaryListSkeleton() {
  return (
    <ul className="divide-y text-sm">
      {(["a", "b", "c"] as const).map((key) => (
        <li
          key={key}
          className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <div className="flex h-5 items-center">
              <Skeleton className="h-4 w-10" />
            </div>
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex items-start gap-1">
            <div className="flex flex-col items-end">
              <div className="flex h-5 items-center">
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex h-4 items-center">
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <span className="flex size-9 items-center justify-center text-muted-foreground/50">
              <HugeiconsIcon
                icon={MoreVerticalIcon}
                size={16}
                strokeWidth={2}
                aria-hidden="true"
              />
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

// The per-person detail surface: the role-detail layout (a wide profile card
// plus a sticky right rail) applied to a person. The left card holds identity
// and classification; the right card holds salary history and the manual
// salary form. Lifecycle actions live behind the header's "..." menu
// (PersonActionsMenu). The route resolves by the short random publicId, never
// the internal Convex id and never a name slug (Role != Person, PII
// minimization; see convex/lib/slug.ts).
export function PersonDetail({ publicId }: { publicId: string }) {
  const t = useTranslations("dashboard.people.detail")
  const tSalaryForm = useTranslations("dashboard.people.salaryForm")
  const tNav = useTranslations("dashboard.nav")
  const { orgId } = useOrganization()
  const locale = useLocale()
  // Amounts render as locale-aware currency (e.g. "94 500 kr" in Swedish,
  // "$94,500" for a USD org), which also removes the need for a separate
  // currency column in the narrow rail.
  const money = useMoney()

  const person = useQuery(api.people.people.getPersonByPublicId, {
    orgId,
    publicId,
  })
  // The dependent queries take the internal personId, so they wait ("skip")
  // until the publicId has resolved.
  const personId = person?.personId
  const assignment = useQuery(
    api.people.assignments.getCurrentAssignment,
    personId !== undefined ? { orgId, personId } : "skip"
  )
  const salary = useQuery(
    api.people.pay.getSalaryHistory,
    personId !== undefined ? { orgId, personId } : "skip"
  )
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })

  usePageTitle(person?.displayName ?? undefined)

  const crumbs: Crumb[] = [
    { label: tNav("people"), href: "/people" },
    { label: person?.displayName ?? "" },
  ]

  // Loading: hold the skeleton until every query has resolved. assignment and
  // roles being undefined (still loading) would cause the classification block
  // to flash "no assignment" then re-render with the real level, so the gate
  // covers all four queries. null/empty still passes (loaded but absent data).
  // Mirror the loaded two-card layout so nothing reflows when data arrives.
  const skeleton = (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={<PageBreadcrumb segments={crumbs} />}
        // h-7 = the PageHeading's text-lg line box (28px); a shorter bar let
        // everything below shift up 4px until the title loaded.
        title={<Skeleton className="h-7 w-48" />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("identityHeading")}</CardTitle>
              {/* The real actions trigger (static chrome, enabled no-op:
                  the load is brief and disabling would just flash gray). */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("actionsMenu")}
                className="shrink-0"
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* The dt labels and the section heading are static i18n text,
                  so they render for real; bars stand in for the values. */}
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {[
                  t("externalRef"),
                  t("employmentStartDate"),
                  t("department"),
                  t("fte"),
                ].map((label) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="flex min-h-5 items-center">
                      <Skeleton className="h-4 w-24 max-w-full" />
                    </dd>
                  </div>
                ))}
              </dl>
              <section className="space-y-2">
                <h2 className="text-muted-foreground text-sm">
                  {t("classificationHeading")}
                </h2>
                <div className="flex min-h-5 items-center gap-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-10 rounded-full" />
                </div>
              </section>
            </CardContent>
          </Card>
          {/* The pay-comparison card's own loading state, so the column
              reserves its full height up front. */}
          <PayComparisonSectionSkeleton />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("salaryHeading")}</CardTitle>
              {/* The real add-salary trigger (static chrome, enabled no-op
                  while loading). */}
              <Button type="button" size="sm">
                {tSalaryForm("addTitle")}
              </Button>
            </CardHeader>
            <CardContent>
              <SalaryListSkeleton />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )

  if (person === undefined || roles === undefined) return skeleton

  if (person === null) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">{t("notFound")}</p>
        <Link className="text-sm underline underline-offset-4" href="/people">
          {t("backToPeople")}
        </Link>
      </div>
    )
  }

  // The dependent queries only start once the person has resolved, so this
  // second gate comes after the not-found branch (they stay "skip" forever
  // for an unknown publicId).
  if (assignment === undefined || salary === undefined) return skeleton

  const role =
    assignment !== null
      ? (roles.find((r) => String(r.roleId) === String(assignment.roleId)) ??
        null)
      : null

  // Role titles for the salary history's role/level join (a missing role,
  // e.g. deleted, still shows the level alone).
  const roleTitleById = new Map(roles.map((r) => [String(r.roleId), r.title]))

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={<PageBreadcrumb segments={crumbs} />}
        title={person.displayName}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Identity + classification card. The person's actions menu lives
              in the card header, mirroring the role profile card's header
              controls. */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("identityHeading")}</CardTitle>
              <PersonActionsMenu
                person={{
                  personId: person.personId,
                  displayName: person.displayName,
                  gender: person.gender,
                  externalRef: person.externalRef,
                  department: person.department,
                  employmentStartDate: person.employmentStartDate,
                  ftePercent: person.ftePercent,
                }}
                roles={roles}
                currentAssignment={
                  assignment !== null
                    ? {
                        roleId: String(assignment.roleId),
                        level: assignment.level,
                      }
                    : null
                }
              />
            </CardHeader>
            <CardContent className="space-y-6">
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">{t("externalRef")}</dt>
                  <dd>{person.externalRef ?? ""}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("employmentStartDate")}
                  </dt>
                  <dd>{person.employmentStartDate ?? ""}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("department")}</dt>
                  <dd>{person.department ?? ""}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("fte")}</dt>
                  <dd>
                    {person.ftePercent != null ? `${person.ftePercent}%` : ""}
                  </dd>
                </div>
              </dl>

              {/* Classification block */}
              <section className="space-y-2">
                <h2 className="text-muted-foreground text-sm">
                  {t("classificationHeading")}
                </h2>
                {assignment === null ? (
                  <p className="text-muted-foreground text-sm">
                    {t("noAssignment")}
                  </p>
                ) : (
                  <div className="flex items-center gap-3 text-sm">
                    {role !== null && (
                      <Link
                        href={`/roles/${role.slug}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {role.title}
                      </Link>
                    )}
                    {/* Confirmed is the default good state: a solid badge and
                        nothing else. A suggested level is provisional, so its
                        badge renders outline and the hint links to Classify,
                        where the confirmation happens. */}
                    <Badge
                      variant={
                        assignment.levelSource === "suggested"
                          ? "outline"
                          : "default"
                      }
                    >
                      {assignment.level}
                    </Badge>
                    {assignment.levelSource === "suggested" && (
                      <Link
                        href="/people/classify"
                        className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-4 hover:underline"
                      >
                        <HugeiconsIcon
                          icon={InformationCircleIcon}
                          size={16}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        {t("suggestedLevelHint")}
                      </Link>
                    )}
                  </div>
                )}
              </section>
            </CardContent>
          </Card>

          {/* Pay comparison against the role: its own card below identity. */}
          <PayComparisonSection
            personId={person.personId}
            trackKey={role?.trackKey}
          />
        </div>

        {/* The salary rail sticks in view while the taller profile scrolls
            (same anatomy as the role page's evaluation rail). The card header
            carries the add-salary dialog trigger; each row's actions live
            behind its trailing "..." menu. */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("salaryHeading")}</CardTitle>
              <AddSalaryDialog personId={person.personId} />
            </CardHeader>
            <CardContent>
              {salary.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t("salaryEmpty")}
                </p>
              ) : (
                // A stacked list, not a table: the rail is a third of the
                // page, and two currency amounts plus a role can never share
                // fixed columns across locales and magnitudes (the headers
                // and values overlapped). Each record stacks instead: year
                // and the role + level it was earned under on the left, the
                // total (the headline number) with the labeled basic beneath
                // on the right; long content wraps or truncates, never
                // overlaps.
                <ul className="divide-y text-sm">
                  {salary.map((record) => (
                    <li
                      key={String(record.payRecordId)}
                      className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium tabular-nums">
                          {record.payYear}
                        </p>
                        {/* The assignment active at the record's effective
                            time, so a promotion's before/after stays
                            readable. Absent when the record predates
                            classification. */}
                        {record.assignment !== null && (
                          <p className="truncate text-muted-foreground text-xs">
                            {(() => {
                              const title = roleTitleById.get(
                                String(record.assignment.roleId)
                              )
                              return title !== undefined && title !== ""
                                ? `${title} · ${record.assignment.level}`
                                : record.assignment.level
                            })()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-start gap-1">
                        <div className="text-right">
                          <p className="whitespace-nowrap font-medium tabular-nums">
                            {money(record.totalMonthlyComp, record.currency)}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {t("salaryColumns.basicMonthly")}{" "}
                            <span className="whitespace-nowrap tabular-nums">
                              {money(record.basicMonthly, record.currency)}
                            </span>
                          </p>
                        </div>
                        <SalaryRowActions
                          payRecordId={record.payRecordId}
                          payYear={record.payYear}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
