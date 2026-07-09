"use client"

import { InformationCircleIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Alert, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import { AnimatePresence } from "motion/react"
import dynamic from "next/dynamic"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { CriterionComplianceDialog } from "@/components/model/criterion-compliance-dialog"
import { CriterionItem } from "@/components/model/criterion-item"
import { CriterionListSkeleton } from "@/components/model/criterion-list-skeleton"
import { MethodStatusBadge } from "@/components/model/method-status-badge"

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

  const [targetId, setTargetId] = useState<Id<"criteria"> | null>(null)

  if (data === undefined) {
    // Content-shaped loading state (never a blank panel): reserve the
    // progress/download toolbar and mirror the criteria rows so the page
    // appears instantly and nothing reflows when the data arrives.
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Reuse the real progress Alert (with its icon) and skeleton only the
              not-yet-known counts, so the toolbar height is identical to the
              loaded state and the list below does not shift. */}
          <Alert className="w-auto">
            <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
            <AlertTitle>
              <Skeleton className="h-5 w-52" />
            </AlertTitle>
          </Alert>
          {/* The real download button (static chrome): it loads its own data
              and disables itself until ready. */}
          <MethodAppendixDownload orgId={orgId} />
        </div>
        <CriterionListSkeleton variant="method" />
      </div>
    )
  }
  if (data === null) return null // no model yet; keep layout stable

  const target =
    targetId === null
      ? null
      : (data.criteria.find((c) => c.criterionId === targetId) ?? null)

  // Mirrors the Weight page's budget status: a check + neutral tint when the
  // model is fully approved, an amber heads-up while documentation is still
  // outstanding. Alert has no warning variant, so the amber tint is a
  // call-site override (same pattern as model-builder.tsx).
  const allApproved =
    data.progress.total > 0 && data.progress.approved === data.progress.total

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Alert
          className={cn(
            "w-auto",
            !allApproved &&
              "border-amber-500/50 text-amber-700 dark:text-amber-400"
          )}
        >
          <HugeiconsIcon
            icon={allApproved ? Tick02Icon : InformationCircleIcon}
            strokeWidth={2}
          />
          <AlertTitle>
            {t("documented", {
              documented: data.progress.documented,
              total: data.progress.total,
            })}
            {" · "}
            {t("approved", {
              approved: data.progress.approved,
              total: data.progress.total,
            })}
          </AlertTitle>
        </Alert>
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
                  <MethodStatusBadge
                    status={c.status}
                    label={t(`status.${c.status}`)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTargetId(c.criterionId)}
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
        onClose={() => setTargetId(null)}
      />
    </div>
  )
}
