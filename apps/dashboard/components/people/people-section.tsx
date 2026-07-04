"use client"

import { UserMultiple02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useMemo } from "react"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { TableSkeleton } from "@/components/table-skeleton"
import { countClassified } from "@/lib/classification-summary"
import { displayNameFor } from "@/lib/person-display"

// The people list surface. Displays active (non-archived) people imported from
// payroll. Includes a classification badge per person derived from the
// listPeopleByTitle query (the single source for badge state and the N-of-M
// summary). The pseudonymizeNames org setting is applied to the name cell.

export function PeopleSection() {
  const t = useTranslations("dashboard.people")
  const tClassify = useTranslations("dashboard.classify")
  const tOrg = useTranslations("dashboard.organization.general")
  const { orgId } = useOrganization()

  const people = useQuery(api.people.people.listPeople, { orgId })
  const byTitle = useQuery(api.people.classificationQueries.listPeopleByTitle, {
    orgId,
  })
  const settings = useQuery(api.accounts.organization.getOrganizationSettings, {
    orgId,
  })

  // Flatten every title group's people ONCE. listPeopleByTitle returns each
  // active person exactly once (including the title: null group), so this is
  // the complete, non-duplicated person set for both the badge and the summary.
  const byTitlePeople = useMemo(
    () => (byTitle ?? []).flatMap((group) => group.people),
    [byTitle]
  )

  // Map personId -> assignment source for O(1) per-row badge lookup.
  const assignmentByPerson = useMemo(() => {
    const m = new Map<string, "confirmed" | "suggested">()
    for (const p of byTitlePeople) {
      if (p.currentAssignment !== null) {
        m.set(String(p.personId), p.currentAssignment.levelSource)
      }
    }
    return m
  }, [byTitlePeople])

  // Summary counts derived from the single flattened source: never from
  // listPeople. A person is classified when their levelSource is "confirmed".
  const summary = useMemo(() => countClassified(byTitlePeople), [byTitlePeople])

  const tableHeader = (
    <TableHeader>
      <TableRow>
        <TableHead>{t("columns.name")}</TableHead>
        <TableHead>{t("columns.gender")}</TableHead>
        <TableHead>{t("columns.department")}</TableHead>
        <TableHead>{t("columns.fte")}</TableHead>
        <TableHead>{t("columns.classification")}</TableHead>
      </TableRow>
    </TableHeader>
  )

  const importAction = (
    <Button asChild>
      <Link href="/people/import">
        <HugeiconsIcon
          icon={UserMultiple02Icon}
          size={16}
          strokeWidth={2}
          aria-hidden="true"
        />
        {t("import.title")}
      </Link>
    </Button>
  )

  const classifyAction = (
    <Button asChild variant="outline">
      <Link href="/people/classify">{t("classifyCta")}</Link>
    </Button>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("heading")}
        description={t("description")}
        action={
          <div className="flex items-center gap-2">
            {classifyAction}
            {importAction}
          </div>
        }
      />

      {people === undefined ||
      byTitle === undefined ||
      settings === undefined ? (
        // Loading: show a content-shaped skeleton while queries resolve.
        // The Skeleton bar reserves the summary line's height so the table
        // does not shift down when data arrives (minimize layout shift rule).
        <>
          <Skeleton className="h-4 w-48" />
          <Table>
            {tableHeader}
            <TableSkeleton rows={8} columns={5} />
          </Table>
        </>
      ) : people.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
          <Button asChild variant="outline">
            <Link href="/people/import">{t("import.title")}</Link>
          </Button>
        </Empty>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {tClassify("summary", {
              classified: summary.classified,
              total: summary.total,
            })}
          </p>
          <Table>
            {tableHeader}
            <TableBody>
              {people.map((person) => {
                const state =
                  assignmentByPerson.get(String(person.personId)) ?? null
                const badge =
                  state === "confirmed"
                    ? {
                        variant: "default" as const,
                        label: t("badge.confirmed"),
                      }
                    : state === "suggested"
                      ? {
                          variant: "secondary" as const,
                          label: t("badge.pending"),
                        }
                      : {
                          variant: "outline" as const,
                          label: t("badge.unclassified"),
                        }

                const name = displayNameFor(
                  person,
                  settings?.pseudonymizeNames ?? false,
                  (ref) => tOrg("pseudonymTemplate", { ref })
                )

                return (
                  <TableRow key={String(person.personId)}>
                    <TableCell className="font-medium">
                      <Link
                        className="underline-offset-4 hover:underline"
                        href={`/people/${String(person.personId)}`}
                      >
                        {name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {person.gender != null
                        ? t(`gender.${person.gender}`)
                        : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {person.department ?? ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {person.ftePercent != null ? `${person.ftePercent}%` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  )
}
