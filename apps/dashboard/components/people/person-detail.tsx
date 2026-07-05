"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
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
import { ErasePersonControl } from "@/components/people/erase-person-control"
import { SalaryForm } from "@/components/people/salary-form"
import { useOrganization } from "@/components/org-context"
import { type Crumb, PageBreadcrumb } from "@/components/page-breadcrumb"
import { PageHeader } from "@/components/page-header"
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "@/components/table-skeleton"
import { usePageTitle } from "@/hooks/use-page-title"

// The per-person detail surface. Reads identity, current assignment (role +
// level), and salary history. Host for the manual salary form (Task 4) and the
// erasure control (Task 5). The route resolves by the raw Convex id, not a slug:
// people are deliberately not route-slugged (Role != Person, PII minimization).

// Skeleton shape per salary column, mirroring the real cells (year, two
// amounts, a currency code, a short source word).
const SALARY_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { className: "w-10" },
  { className: "w-16" },
  { className: "w-16" },
  { className: "w-10" },
  { className: "w-14" },
]
export function PersonDetail({ personId }: { personId: string }) {
  const t = useTranslations("dashboard.people.detail")
  const tNav = useTranslations("dashboard.nav")
  const { orgId } = useOrganization()
  const locale = useLocale()

  const typedId = personId as Id<"people">
  const person = useQuery(api.people.people.getPerson, {
    orgId,
    personId: typedId,
  })
  const assignment = useQuery(api.people.assignments.getCurrentAssignment, {
    orgId,
    personId: typedId,
  })
  const salary = useQuery(api.people.pay.getSalaryHistory, {
    orgId,
    personId: typedId,
  })
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })

  usePageTitle(person?.displayName ?? undefined)

  const crumbs: Crumb[] = [
    { label: tNav("people"), href: "/people" },
    { label: person?.displayName ?? "" },
  ]

  // Loading: hold the skeleton until ALL four queries resolve. assignment and
  // roles being undefined (still loading) would cause the classification block
  // to flash "no assignment" then re-render with the real level, so widen the
  // gate here. null/empty still passes (loaded but absent data).
  if (
    person === undefined ||
    salary === undefined ||
    assignment === undefined ||
    roles === undefined
  ) {
    // Mirror the full loaded layout so nothing reflows when data arrives.
    // The breadcrumb crumbs already has an empty label for the person name
    // position; the PageHeader title uses a Skeleton bar to avoid a text swap.
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumb={<PageBreadcrumb segments={crumbs} />}
          title={<Skeleton className="h-6 w-48" />}
        />

        {/* Identity block skeleton: same 4-column grid as the loaded state */}
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </dl>

        {/* Classification block skeleton: same section wrapper as loaded state */}
        <section className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-10 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        </section>

        {/* Salary block skeleton: same section + h2 + table wrapper as loaded state */}
        <section className="space-y-2">
          <Skeleton className="h-4 w-28" />
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
        </section>
      </div>
    )
  }

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

  const roleTitle =
    assignment !== undefined && assignment !== null && roles !== undefined
      ? (roles.find((r) => String(r.roleId) === String(assignment.roleId))
          ?.title ?? "")
      : ""

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={<PageBreadcrumb segments={crumbs} />}
        title={person.displayName}
      />

      {/* Identity block */}
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{t("externalRef")}</dt>
          <dd>{person.externalRef ?? ""}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("employmentStartDate")}</dt>
          <dd>{person.employmentStartDate ?? ""}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("department")}</dt>
          <dd>{person.department ?? ""}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("fte")}</dt>
          <dd>{person.ftePercent != null ? `${person.ftePercent}%` : ""}</dd>
        </div>
      </dl>

      {/* Classification block */}
      <section className="space-y-2">
        <h2 className="font-medium text-sm">{t("classificationHeading")}</h2>
        {assignment === undefined || assignment === null ? (
          <p className="text-muted-foreground text-sm">{t("noAssignment")}</p>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <span>{roleTitle}</span>
            <Badge>{assignment.level}</Badge>
            <span className="text-muted-foreground">
              {assignment.levelSource === "confirmed"
                ? t("sourceConfirmed")
                : t("sourceSuggested")}
            </span>
          </div>
        )}
      </section>

      {/* Salary history block */}
      <section className="space-y-2">
        <h2 className="font-medium text-sm">{t("salaryHeading")}</h2>
        {salary.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("salaryEmpty")}</p>
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
      </section>

      <SalaryForm personId={person.personId} />

      <section className="flex justify-end border-t pt-4">
        <ErasePersonControl
          personId={person.personId}
          displayName={person.displayName}
          externalRef={person.externalRef}
        />
      </section>
    </div>
  )
}
