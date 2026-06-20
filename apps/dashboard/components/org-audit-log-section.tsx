"use client"

import { api } from "@workspace/backend/convex/_generated/api"
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
import { usePaginatedQuery } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { useOrganization } from "@/components/org-context"
import { aiAuditDetail, formatAuditDetail } from "@/lib/audit-detail"

// Derive the i18n key from an event type value by camelCasing across dots, so
// "organization.created" -> "organizationCreated", "ai.suggestionConfirmed" ->
// "aiSuggestionConfirmed". The keys under dashboard.auditLog.events mirror this.
function eventKey(type: string): string {
  return type
    .split(".")
    .map((part, index) =>
      index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("")
}

export function OrgAuditLogSection() {
  const t = useTranslations("dashboard.auditLog")
  const format = useFormatter()
  const { orgId, role } = useOrganization()
  // Editors never call the query: the adminQuery would reject them. The cosmetic
  // guard keeps the page graceful (the sidebar item is hidden for them anyway).
  // Unit 3 replaces this with the full paginated browse + search UI; for now the
  // first page is rendered so the section keeps working against the new query.
  const { results, status } = usePaginatedQuery(
    api.accounts.audit.listAuditLog,
    role === "admin" ? { orgId } : "skip",
    { initialNumItems: 50 }
  )

  // Translate an event type to its label, falling back to the raw type when no
  // key exists (a future event added before its string). t.has guards the
  // lookup so a missing key never logs an error or renders the raw key path.
  function actionLabel(type: string): string {
    const key = `events.${eventKey(type)}` as Parameters<typeof t.has>[0]
    return t.has(key) ? t(key) : type
  }

  // The "who" column: seeded/system-generated rows carry a "system" sentinel
  // actorId (and an "unknown" snapshotted name); show a localized System label
  // for them, the real name when we have one, and Unknown otherwise.
  function actorLabel(actorId: string, actorName: string): string {
    if (actorId === "system" || actorId.startsWith("system")) {
      return t("who.system")
    }
    return actorName && actorName !== "unknown" ? actorName : t("who.unknown")
  }

  if (role !== "admin") {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="font-medium text-lg">{t("heading")}</h2>
        </div>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("notAuthorized")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    )
  }

  if (status === "LoadingFirstPage") return null
  const rows = results

  // The Details cell: AI suggestion events render from their own payload
  // (counts), everything else through the shared structured-change formatter.
  // names is now per row (the paginated query enriches each row with only the
  // ids it references).
  function detailText(
    type: string,
    payload: unknown,
    names: Record<string, string>
  ): string {
    if (type === "ai.suggestionConfirmed" || type === "ai.suggestionRejected") {
      // aiAuditDetail builds key paths at runtime (ai.<kind>); widen t to a
      // plain (key, params) signature so the runtime keys are accepted.
      return aiAuditDetail(type, payload, (key, params) =>
        t(key as Parameters<typeof t>[0], params)
      )
    }
    return formatAuditDetail(
      type,
      payload,
      names,
      {
        deletedRole: t("details.deletedRole"),
        deletedFamily: t("details.deletedFamily"),
        deletedUser: t("details.deletedUser"),
      },
      (f) => {
        const key = `fields.${f}` as Parameters<typeof t.has>[0]
        return t.has(key) ? t(key) : f
      }
    )
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-medium text-lg">{t("heading")}</h2>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      {rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.when")}</TableHead>
              <TableHead>{t("table.who")}</TableHead>
              <TableHead>{t("table.action")}</TableHead>
              <TableHead>{t("table.details")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground">
                  {format.dateTime(new Date(row.at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </TableCell>
                <TableCell className="font-medium">
                  {actorLabel(row.actorId, row.actorName)}
                </TableCell>
                <TableCell>{actionLabel(row.type)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {detailText(row.type, row.payload, row.names)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
