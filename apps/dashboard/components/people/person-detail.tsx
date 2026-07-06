"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useQuery } from "convex/react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { AddSalaryDialog } from "@/components/people/add-salary-dialog"
import { PersonActionsMenu } from "@/components/people/person-actions-menu"
import { SalaryRowActions } from "@/components/people/salary-row-actions"
import { useOrganization } from "@/components/org-context"
import { type Crumb, PageBreadcrumb } from "@/components/page-breadcrumb"
import { PageHeader } from "@/components/page-header"
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "@/components/table-skeleton"
import { usePageTitle } from "@/hooks/use-page-title"

// Skeleton shape per salary column, mirroring the real cells (year, two
// currency-formatted amounts, the role/level pair, the row-actions button).
const SALARY_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { className: "w-10" },
  { className: "w-20" },
  { className: "w-20" },
  { className: "w-16" },
  { className: "ml-auto size-9 rounded-md" },
]

// The per-person detail surface: the role-detail layout (a wide profile card
// plus a sticky right rail) applied to a person. The left card holds identity
// and classification; the right card holds salary history and the manual
// salary form. Lifecycle actions live behind the header's "..." menu
// (PersonActionsMenu). The route resolves by the short random publicId, never
// the internal Convex id and never a name slug (Role != Person, PII
// minimization; see convex/lib/slug.ts).
export function PersonDetail({ publicId }: { publicId: string }) {
  const t = useTranslations("dashboard.people.detail")
  const tNav = useTranslations("dashboard.nav")
  const { orgId } = useOrganization()
  const locale = useLocale()

  const format = useFormatter()

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

  // Amounts render as locale-aware currency (e.g. "94 500 kr"), which also
  // removes the need for a separate currency column in the narrow rail.
  // Imported currency strings are not schema-constrained, so an unknown code
  // falls back to the raw pair instead of throwing.
  function money(value: number, currency: string): string {
    try {
      return format.number(value, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      })
    } catch {
      return `${value} ${currency}`
    }
  }

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
        title={<Skeleton className="h-6 w-48" />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("identityHeading")}</CardTitle>
              <Skeleton className="size-9 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-6">
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
                  <div key={i} className="space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </dl>
              <section className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-10 rounded-full" />
                </div>
              </section>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("salaryHeading")}</CardTitle>
              <Skeleton className="h-8 w-24 rounded-md" />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("salaryColumns.payYear")}</TableHead>
                    <TableHead>{t("salaryColumns.basicMonthly")}</TableHead>
                    <TableHead>{t("salaryColumns.total")}</TableHead>
                    <TableHead>{t("salaryColumns.role")}</TableHead>
                    <TableHead>
                      <span className="sr-only">{t("salaryRowActions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableSkeleton rows={3} columns={SALARY_SKELETON_COLUMNS} />
              </Table>
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
                personId={person.personId}
                displayName={person.displayName}
                externalRef={person.externalRef}
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
                <h2 className="font-medium text-sm">
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
                    <Badge>{assignment.level}</Badge>
                    {/* Confirmed is the default good state and says nothing;
                        only the suggested hint carries information (go
                        confirm it on Classify). */}
                    {assignment.levelSource === "suggested" && (
                      <span className="text-muted-foreground">
                        {t("sourceSuggested")}
                      </span>
                    )}
                  </div>
                )}
              </section>
            </CardContent>
          </Card>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("salaryColumns.payYear")}</TableHead>
                      <TableHead>{t("salaryColumns.basicMonthly")}</TableHead>
                      <TableHead>{t("salaryColumns.total")}</TableHead>
                      <TableHead>{t("salaryColumns.role")}</TableHead>
                      <TableHead>
                        <span className="sr-only">{t("salaryRowActions")}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salary.map((record) => (
                      <TableRow key={String(record.payRecordId)}>
                        <TableCell>{record.payYear}</TableCell>
                        <TableCell className="tabular-nums">
                          {money(record.basicMonthly, record.currency)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {money(record.totalMonthlyComp, record.currency)}
                        </TableCell>
                        {/* The role + level the salary was earned under (the
                            assignment active at the record's effective time),
                            so a promotion's before/after stays readable.
                            Empty when the record predates classification. */}
                        <TableCell>
                          {record.assignment !== null && (
                            <div className="min-w-0 max-w-32">
                              <p className="truncate">
                                {roleTitleById.get(
                                  String(record.assignment.roleId)
                                ) ?? ""}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {record.assignment.level}
                              </p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="w-8 text-right">
                          <SalaryRowActions
                            payRecordId={record.payRecordId}
                            payYear={record.payYear}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
