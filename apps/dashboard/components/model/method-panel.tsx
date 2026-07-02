"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { useQuery } from "convex/react"
import dynamic from "next/dynamic"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { CriterionComplianceDialog } from "@/components/model/criterion-compliance-dialog"

const MethodAppendixDownload = dynamic(
  () =>
    import("@/components/pdf/method-appendix-download").then(
      (m) => m.MethodAppendixDownload
    ),
  { ssr: false }
)

// The Method tab panel. Queries the method model and renders a list of
// criteria with their compliance status pill and a Document button.
// A single per-row action stays as a button (not a dropdown) per the
// convention: row-action dropdown is for two or more actions.
// MethodAppendixDownload renders the PDF export button above the list.
export function MethodPanel({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.method")
  const locale = useLocale()
  const data = useQuery(api.evaluationModel.method.getMethodModel, {
    orgId,
    locale,
  })
  const [target, setTarget] = useState<
    NonNullable<typeof data>["criteria"][number] | null
  >(null)

  if (data == null) return null // loading or null; keep layout stable

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {t("documented", {
            documented: data.progress.documented,
            total: data.progress.total,
          })}
          {" · "}
          {t("approved", {
            approved: data.progress.approved,
            total: data.progress.total,
          })}
        </p>
        <MethodAppendixDownload orgId={orgId} />
      </div>
      <ul className="space-y-2">
        {data.criteria.map((c) => (
          <li
            key={c.criterionId}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{c.name}</p>
              <p className="text-muted-foreground text-sm tabular-nums">
                {c.share}%
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={c.status === "approved" ? "default" : "secondary"}
              >
                {t(`status.${c.status}`)}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setTarget(c)}>
                {t("openCta")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <CriterionComplianceDialog
        orgId={orgId}
        target={target}
        onClose={() => setTarget(null)}
      />
    </div>
  )
}
