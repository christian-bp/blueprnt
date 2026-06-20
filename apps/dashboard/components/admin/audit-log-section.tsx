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
import { formatChanges } from "@/lib/audit-detail"

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
  const tFields = useTranslations("dashboard.auditLog")
  const format = useFormatter()
  const rows = useQuery(api.platform.admin.listAuditLog, {})

  // Resolve a change field name to its localized label, falling back to the raw
  // field name when no key exists.
  function fieldLabel(field: string): string {
    const key = `fields.${field}` as Parameters<typeof tFields.has>[0]
    return tFields.has(key) ? tFields(key) : field
  }

  // Structured before->after diffs (e.g. platform.orgUpdated) render via
  // formatChanges; everything else keeps the flat "key: value" rendering.
  function detail(payload: unknown): string {
    if (
      payload !== null &&
      typeof payload === "object" &&
      "changes" in payload &&
      (payload as { changes: unknown }).changes !== null &&
      typeof (payload as { changes: unknown }).changes === "object"
    ) {
      return formatChanges(
        (payload as { changes: Record<string, { from: unknown; to: unknown }> })
          .changes,
        fieldLabel
      )
    }
    return formatPayload(payload)
  }

  // Translate an event type to its label, falling back to the raw type when no
  // key exists (e.g. a future event added before its string). t.has guards the
  // lookup so a missing key never logs an error or renders the raw key path.
  function actionLabel(type: string): string {
    const key = `events.${type.replace("platform.", "")}` as Parameters<
      typeof t.has
    >[0]
    return t.has(key) ? t(key) : type
  }

  // Out-of-band rows (e.g. the CLI bootstrap path) carry a "system:cli"
  // sentinel actorId rather than a real operator; show a localized System label.
  function operatorLabel(actorId: string, actorName: string): string {
    return actorId.startsWith("system") ? t("systemActor") : actorName
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
                <TableCell className="font-medium">
                  {operatorLabel(row.actorId, row.actorName)}
                </TableCell>
                <TableCell>{actionLabel(row.type)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {composeTarget(row.targetUser, row.targetOrg)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {detail(row.payload)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
