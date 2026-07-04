"use client"

import { UserMultiple02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
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
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { TableSkeleton } from "@/components/table-skeleton"

// The people list surface. Displays active (non-archived) people imported from
// payroll. The displayName shown here is the raw stored value; supporting a
// pseudonymizeNames org toggle (show initials instead) is a deferred follow-up.

export function PeopleSection() {
  const t = useTranslations("dashboard.people")
  const { orgId } = useOrganization()

  const people = useQuery(api.people.people.listPeople, { orgId })

  const tableHeader = (
    <TableHeader>
      <TableRow>
        <TableHead>{t("columns.name")}</TableHead>
        <TableHead>{t("columns.gender")}</TableHead>
        <TableHead>{t("columns.department")}</TableHead>
        <TableHead>{t("columns.fte")}</TableHead>
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
        {t("import")}
      </Link>
    </Button>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("heading")}
        description={t("description")}
        action={importAction}
      />

      {people === undefined ? (
        // Loading: show a content-shaped skeleton while the query resolves.
        <Table>
          {tableHeader}
          <TableSkeleton rows={8} columns={4} />
        </Table>
      ) : people.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
          <Button asChild variant="outline">
            <Link href="/people/import">{t("import")}</Link>
          </Button>
        </Empty>
      ) : (
        <Table>
          {tableHeader}
          <TableBody>
            {people.map((person) => (
              <TableRow key={String(person.personId)}>
                <TableCell className="font-medium">
                  {person.displayName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {person.gender != null ? t(`gender.${person.gender}`) : ""}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {person.department ?? ""}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {person.ftePercent != null ? `${person.ftePercent}%` : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
