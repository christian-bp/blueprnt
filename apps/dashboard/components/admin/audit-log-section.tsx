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
import { useQuery } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"

// Compose the human-readable target from the resolved user/org labels: user,
// org, "user @ org" when both, or "" when neither.
function composeTarget(
  targetUser: string | null,
  targetOrg: string | null
): string {
  if (targetUser !== null && targetOrg !== null) {
    return `${targetUser} @ ${targetOrg}`
  }
  return targetUser ?? targetOrg ?? ""
}

// Render the payload compactly as plain text: "key: value" pairs joined with
// commas, arrays joined with commas. No raw JSON braces. Payloads carry IDs and
// codes only (never PII), so this is safe to surface verbatim.
function formatPayload(payload: unknown): string {
  if (payload === null || typeof payload !== "object") return ""
  return Object.entries(payload as Record<string, unknown>)
    .map(([key, value]) => {
      const text = Array.isArray(value) ? value.join(", ") : String(value)
      return `${key}: ${text}`
    })
    .join(", ")
}

export function AuditLogSection() {
  const t = useTranslations("dashboard.admin.auditLog")
  const format = useFormatter()
  const rows = useQuery(api.platform.admin.listAuditLog, {})

  // Translate an event type to its label, falling back to the raw type when no
  // key exists (e.g. a future event added before its string). t.has guards the
  // lookup so a missing key never logs an error or renders the raw key path.
  function actionLabel(type: string): string {
    const key = `events.${type.replace("platform.", "")}` as Parameters<
      typeof t.has
    >[0]
    return t.has(key) ? t(key) : type
  }

  if (rows === undefined) return null

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
              <TableHead>{t("table.operator")}</TableHead>
              <TableHead>{t("table.action")}</TableHead>
              <TableHead>{t("table.target")}</TableHead>
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
                <TableCell className="font-medium">{row.actorName}</TableCell>
                <TableCell>{actionLabel(row.type)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {composeTarget(row.targetUser, row.targetOrg)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatPayload(row.payload)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
