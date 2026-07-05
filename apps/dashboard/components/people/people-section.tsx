"use client"

import {
  InformationCircleIcon,
  Tick02Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Alert, AlertTitle } from "@workspace/ui/components/alert"
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
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useMemo } from "react"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "@/components/table-skeleton"
import { useClassificationSummary } from "@/hooks/use-classification-summary"
import { displayNameFor } from "@/lib/person-display"

// The people list surface. Displays active (non-archived) people imported from
// payroll. Includes a classification badge per person derived from the
// listPeopleByTitle query (the single source for badge state and the N-of-M
// summary). The pseudonymizeNames org setting is applied to the name cell.

// Skeleton shape per column, mirroring the real row content (name link, short
// gender word, department, tiny FTE value, classification badge pill) so the
// loading table has the same silhouette as the loaded one.
const PEOPLE_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { className: "w-36 max-w-full" },
  { className: "w-16" },
  { className: "w-28 max-w-full" },
  { className: "w-10" },
  { className: "h-5 w-24 rounded-full" },
]

export function PeopleSection() {
  const t = useTranslations("dashboard.people")
  const tClassify = useTranslations("dashboard.classify")
  const tOrg = useTranslations("dashboard.organization.general")
  const { orgId } = useOrganization()

  const people = useQuery(api.people.people.listPeople, { orgId })
  // Shared flattened person set + summary (also feeds the Classify tab's
  // remaining-count badge, so the two can never disagree).
  const {
    loading: byTitleLoading,
    people: byTitlePeople,
    summary,
  } = useClassificationSummary(orgId)
  const settings = useQuery(api.accounts.organization.getOrganizationSettings, {
    orgId,
  })

  // Mirrors the model pages' progress status (method-panel.tsx): a check +
  // neutral tint when everyone is classified, an amber heads-up while people
  // still await classification.
  const allClassified =
    summary.total > 0 && summary.classified === summary.total

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

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("heading")}
        description={t("description")}
        // Classification now lives on its own header tab (PeopleTabs), so the
        // header keeps a single primary action.
        action={importAction}
      />

      {people === undefined || byTitleLoading || settings === undefined ? (
        // Loading: show a content-shaped skeleton while queries resolve.
        // Reuse the real summary Alert (with its icon) and skeleton only the
        // not-yet-known counts, so the toolbar height is identical to the
        // loaded state and the table does not shift down when data arrives
        // (same pattern as method-panel.tsx).
        <>
          <div className="flex">
            <Alert className="w-auto">
              <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
              <AlertTitle>
                <Skeleton className="h-5 w-40" />
              </AlertTitle>
            </Alert>
          </div>
          <Table>
            {tableHeader}
            <TableSkeleton rows={8} columns={PEOPLE_SKELETON_COLUMNS} />
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
          {/* Alert has no warning variant, so the amber tint is a call-site
              override (same pattern as method-panel.tsx / model-builder.tsx).
              The flex wrapper lets w-auto shrink the Alert to its content. */}
          <div className="flex">
            <Alert
              className={cn(
                "w-auto",
                !allClassified &&
                  "border-amber-500/50 text-amber-700 dark:text-amber-400"
              )}
            >
              <HugeiconsIcon
                icon={allClassified ? Tick02Icon : InformationCircleIcon}
                strokeWidth={2}
              />
              <AlertTitle>
                {tClassify("summary", {
                  classified: summary.classified,
                  total: summary.total,
                })}
              </AlertTitle>
            </Alert>
          </div>
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
