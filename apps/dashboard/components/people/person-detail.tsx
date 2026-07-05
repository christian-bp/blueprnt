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
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { PersonActionsMenu } from "@/components/people/person-actions-menu"
import { SalaryForm } from "@/components/people/salary-form"
import { useOrganization } from "@/components/org-context"
import { type Crumb, PageBreadcrumb } from "@/components/page-breadcrumb"
import { PageHeader } from "@/components/page-header"
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "@/components/table-skeleton"
import { usePageTitle } from "@/hooks/use-page-title"

// Skeleton shape per salary column, mirroring the real cells (year, two
// amounts, a currency code, a short source word).
const SALARY_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { className: "w-10" },
  { className: "w-16" },
  { className: "w-16" },
  { className: "w-10" },
  { className: "w-14" },
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
        title={<Skeleton className="h-6 w-48" />}
        action={<Skeleton className="size-9 rounded-md" />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("identityHeading")}</CardTitle>
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
                  <Skeleton className="h-4 w-20" />
                </div>
              </section>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("salaryHeading")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("salaryColumns.payYear")}</TableHead>
                    <TableHead>{t("salaryColumns.basicMonthly")}</TableHead>
                    <TableHead>{t("salaryColumns.total")}</TableHead>
                    <TableHead>{t("salaryColumns.currency")}</TableHead>
                    <TableHead>{t("salaryColumns.source")}</TableHead>
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

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={<PageBreadcrumb segments={crumbs} />}
        title={person.displayName}
        action={
          <PersonActionsMenu
            personId={person.personId}
            displayName={person.displayName}
            externalRef={person.externalRef}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Identity + classification card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("identityHeading")}</CardTitle>
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
                    <span className="text-muted-foreground">
                      {assignment.levelSource === "confirmed"
                        ? t("sourceConfirmed")
                        : t("sourceSuggested")}
                    </span>
                  </div>
                )}
              </section>
            </CardContent>
          </Card>
        </div>

        {/* The salary rail sticks in view while the taller profile scrolls
            (same anatomy as the role page's evaluation rail). */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>{t("salaryHeading")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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
                      <TableHead>{t("salaryColumns.currency")}</TableHead>
                      <TableHead>{t("salaryColumns.source")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salary.map((record) => (
                      <TableRow key={String(record.payRecordId)}>
                        <TableCell>{record.payYear}</TableCell>
                        <TableCell>{record.basicMonthly}</TableCell>
                        <TableCell>{record.totalMonthlyComp}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.currency}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.source === "import"
                            ? t("sourceImport")
                            : t("sourceManual")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <SalaryForm personId={person.personId} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
