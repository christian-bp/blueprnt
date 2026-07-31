"use client"

import { UserMultiple02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import NumberFlow from "@number-flow/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
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
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { type ReactNode, useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SuggestedRoleBadge } from "@/components/suggested-role-badge"
import { TablePagination } from "@/components/table-pagination"
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "@/components/table-skeleton"
import { LevelBadge } from "@/components/track-badge"

// The employees currently classified into this role: the reciprocal of the
// person page's role link, so a role answers "who holds it?" without a detour
// via the people register (which filters by role but is organized by person).
// Read-only by design: classification is done on the Classify page, and the
// role tables never carry person data (Role != Person), so every value here
// comes from the people context and every name links back into it.

const PAGE_SIZE = 25

// Skeleton shape per column, mirroring the real row content (name link, level
// badge, department, short FTE value).
const ROLE_PEOPLE_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { className: "w-36 max-w-full" },
  { className: "h-5 w-12 rounded-full" },
  { className: "w-28 max-w-full" },
  { className: "w-10" },
]

// Shared by the loaded table and the loading skeleton so the two cannot
// drift. Fixed widths (with table-fixed): auto layout re-measures columns
// from the visible rows, so widths would jump on a page flip or when the
// skeleton swaps for data. Name takes the remaining space; level is w-28 to
// fit the widest level code, department and FTE mirror the people register.
function RolePeopleTableHeader() {
  const t = useTranslations("dashboard.people.columns")
  const tHelp = useTranslations("dashboard.help")
  return (
    <TableHeader>
      <TableRow>
        <TableHead>{t("name")}</TableHead>
        <TableHead className="w-28">
          {/* Level is the one domain term this surface introduces (the
              individual's seniority within the role's track, never the role's
              own weight), so its help sits on the column that uses it. */}
          <span className="flex items-center gap-1.5">
            {t("level")}
            <HelpMorphButton label={tHelp("classifyLevelLabel")}>
              {tHelp("classifyLevelBody")}
            </HelpMorphButton>
          </span>
        </TableHead>
        <TableHead className="w-[22%]">{t("department")}</TableHead>
        <TableHead className="w-28">{t("fte")}</TableHead>
      </TableRow>
    </TableHeader>
  )
}

// The card frame around whichever state the list is in, so the title, the
// count slot and the padding are declared once. The count is omitted while
// loading and when the role has no holders.
function RolePeopleShell({
  count,
  children,
}: {
  count?: number
  children: ReactNode
}) {
  const t = useTranslations("dashboard.roles.detail.people")
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("heading")}</CardTitle>
        {/* The query is reactive, so a reclassification elsewhere changes
            this count while it is on screen: NumberFlow rolls the digits
            instead of swapping them. */}
        {count !== undefined && count > 0 && (
          <Badge variant="secondary">
            <NumberFlow value={count} />
          </Badge>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// Content-shaped loading state, also used by the role page's own skeleton so
// the card is already in place when the page's data arrives. Unpaginated
// placeholder: sized to a typical role's headcount, not to a full pager page.
export function RolePeopleCardSkeleton() {
  return (
    <RolePeopleShell>
      <Table className="table-fixed">
        <RolePeopleTableHeader />
        <TableSkeleton rows={4} columns={ROLE_PEOPLE_SKELETON_COLUMNS} />
      </Table>
    </RolePeopleShell>
  )
}

export function RolePeopleCard({
  orgId,
  roleId,
  archived,
}: {
  orgId: string
  roleId: Id<"roles">
  // Archiving a role ends every open assignment, so an archived role can
  // never have holders. Saying "not classified yet" and offering Classify
  // (which hides archived roles) would be a dead end.
  archived: boolean
}) {
  const t = useTranslations("dashboard.roles.detail.people")
  const tClassify = useTranslations("dashboard.people.import.done")
  const tToolbar = useTranslations("dashboard.people.toolbar")
  const locale = useLocale()
  const [page, setPage] = useState(0)

  const people = useQuery(api.people.assignments.listPeopleForRole, {
    orgId,
    roleId,
    locale,
  })

  const total = people?.length ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // Clamped during render instead of in an effect: a reactive update that
  // shrinks the list (someone reclassified elsewhere) must never leave the
  // pager on a page that no longer exists.
  const current = Math.min(page, pageCount - 1)
  const pageRows = (people ?? []).slice(
    current * PAGE_SIZE,
    current * PAGE_SIZE + PAGE_SIZE
  )

  if (people === undefined) return <RolePeopleCardSkeleton />

  return (
    <RolePeopleShell count={total}>
      {total === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon
                icon={UserMultiple02Icon}
                strokeWidth={2}
                aria-hidden="true"
              />
            </EmptyMedia>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            {/* State the precondition in words: employees reach a role by
                being classified, which happens on the Classify page. */}
            <EmptyDescription>
              {archived ? t("archivedEmpty") : t("empty")}
            </EmptyDescription>
          </EmptyHeader>
          {!archived && (
            <Link
              href="/people/classify"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              {tClassify("goToClassify")}
            </Link>
          )}
        </Empty>
      ) : (
        <div className="space-y-4">
          <Table className="table-fixed">
            <RolePeopleTableHeader />
            <TableBody>
              {pageRows.map((row) => (
                <TableRow key={row.personId}>
                  <TableCell className="font-medium">
                    {/* Name truncates; the suggested badge stays visible
                        beside it. */}
                    <div className="flex items-center gap-2">
                      <Link
                        className="truncate underline-offset-4 hover:underline"
                        href={`/people/${row.publicId}`}
                      >
                        {row.displayName}
                      </Link>
                      {row.levelSource === "suggested" && (
                        <SuggestedRoleBadge />
                      )}
                    </div>
                  </TableCell>
                  {/* Block flex wrapper: an inline-flex badge directly in
                      the cell sits on the text baseline and inflates the
                      line box, desyncing the row height from the skeleton
                      rows. */}
                  <TableCell>
                    <div className="flex items-center">
                      <LevelBadge level={row.level} />
                    </div>
                  </TableCell>
                  <TableCell className="truncate text-muted-foreground">
                    {row.department ?? ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.ftePercent != null ? `${row.ftePercent}%` : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pageCount > 1 && (
            <div className="flex justify-center">
              <TablePagination
                page={current}
                pageCount={pageCount}
                hasMore={false}
                canPrev={current > 0}
                canNext={current < pageCount - 1}
                onPrev={() => setPage(current - 1)}
                onNext={() => setPage(current + 1)}
                onSelect={setPage}
                previousLabel={tToolbar("previous")}
                nextLabel={tToolbar("next")}
              />
            </div>
          )}
        </div>
      )}
    </RolePeopleShell>
  )
}
