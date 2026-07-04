"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
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
import { useOrganization } from "@/components/org-context"
import { type Crumb, PageBreadcrumb } from "@/components/page-breadcrumb"
import { PageHeader } from "@/components/page-header"
import { TableSkeleton } from "@/components/table-skeleton"
import { usePageTitle } from "@/hooks/use-page-title"

// The per-person detail surface. Reads identity, current assignment (role +
// level), and salary history. Host for the manual salary form (Task 4) and the
// erasure control (Task 5). The route resolves by the raw Convex id, not a slug:
// people are deliberately not route-slugged (Role != Person, PII minimization).
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

  // Loading: person or salary still resolving. Show a content-shaped skeleton.
  if (person === undefined || salary === undefined) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumb={<PageBreadcrumb segments={crumbs} />}
          title={t("identityHeading")}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("salaryColumns.payYear")}</TableHead>
              <TableHead>{t("salaryColumns.basicMonthly")}</TableHead>
              <TableHead>{t("salaryColumns.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableSkeleton rows={3} columns={3} />
        </Table>
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

      {/* Task 4 mounts <SalaryForm personId={person.personId} /> here. */}
      {/* Task 5 mounts <ErasePersonControl personId={person.personId}
          displayName={person.displayName} externalRef={person.externalRef} />
          here. */}
    </div>
  )
}
