"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { useQuery } from "convex/react"
import dynamic from "next/dynamic"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { AnimatePresence } from "motion/react"
import { CriterionItem } from "@/components/model/criterion-item"
import { CriterionComplianceDialog } from "@/components/model/criterion-compliance-dialog"

const MethodAppendixDownload = dynamic(
  () =>
    import("@/components/pdf/method-appendix-download").then(
      (m) => m.MethodAppendixDownload
    ),
  { ssr: false }
)

// The Method tab panel. Queries the method model and renders a list of
// criteria using the shared CriterionItem (parity with the Weighting page),
// with their compliance status badge and a Document action button in the
// importance slot. MethodAppendixDownload renders the PDF export button above
// the list.
export function MethodPanel({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.method")
  const tBuilder = useTranslations("dashboard.model.builder")
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
      {/* No space-y/gap on the ul: CriterionItem manages its own marginBottom
          via the motion.li variants; consumer gap would double-space items. */}
      <ul>
        <AnimatePresence initial={false}>
          {data.criteria.map((c) => (
            <CriterionItem
              key={c.criterionId}
              name={c.name}
              description={c.description || undefined}
              extendedDescription={c.helpText || undefined}
              editable={false}
              note={
                <span>
                  <span className="font-medium text-foreground tabular-nums">
                    {c.share}%
                  </span>{" "}
                  {tBuilder("shareOfTotal")}
                </span>
              }
              importanceNode={
                <span className="flex items-center gap-2">
                  <Badge
                    variant={c.status === "approved" ? "default" : "secondary"}
                  >
                    {t(`status.${c.status}`)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTarget(c)}
                  >
                    {t("openCta")}
                  </Button>
                </span>
              }
            />
          ))}
        </AnimatePresence>
      </ul>
      <CriterionComplianceDialog
        orgId={orgId}
        target={target}
        onClose={() => setTarget(null)}
      />
    </div>
  )
}
