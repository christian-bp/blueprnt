import { Medallion } from "@/components/medallion"
import { Alert02Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert, AlertTitle } from "@workspace/ui/components/alert"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { WARNING_ALERT_CLASS } from "@/lib/alert-tone"
import { chapterHref } from "@/lib/model-chapters"
import { MAX_ITEMS } from "@/lib/todo"

export interface PreconditionRole {
  roleId: string
  title: string
  slug: string
}

// The recommended (non-blocking) drift warning: some staffed roles that DO
// satisfy the gate (evaluated and locked, so they never appear among the
// blocking rows below) were locked before the model's current approval.
// Exported so both the blocking panel below (when drift co-occurs with a
// separate blocker) and the start dialog's ready-state form (when drift is
// the ONLY thing left to note, which is the common case: the gate does not
// block on drift, so ready is usually reached first) render the identical
// wording and styling instead of two copies that could drift apart
// themselves. Alert has no warning variant; the amber tint is the
// established call-site override (see lib/alert-tone.ts,
// people/import/review-step.tsx).
export function PayMappingDriftWarning({ count }: { count: number }) {
  const t = useTranslations("dashboard.payMapping.preconditions")
  return (
    <Alert role="status" className={WARNING_ALERT_CLASS}>
      <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} aria-hidden="true" />
      <AlertTitle>{t("driftWarning", { count })}</AlertTitle>
    </Alert>
  )
}

// The plain-language guidance shown in place of the create form while the
// pay-mapping gate is unmet (the guidance rule: preconditions in words,
// never silently disabled). One row per unmet condition, each a full-width
// link to where the work happens; the unevaluated-role rows below the
// evaluate line are capped at MAX_ITEMS, the same cap the to-do uses. The
// model-approval row leads: without an approved model there is no reviewed
// method to freeze as this run's evidence, which every other precondition
// presupposes.
export function PayMappingPreconditionsPanel({
  peopleCount,
  unclassifiedCount,
  unevaluatedRoles,
  modelApproved,
  driftedRolesCount,
}: {
  peopleCount: number
  unclassifiedCount: number
  unevaluatedRoles: PreconditionRole[]
  modelApproved: boolean
  driftedRolesCount: number
}) {
  const t = useTranslations("dashboard.payMapping.preconditions")
  // The continue-item anatomy (bordered, brand chevron): these rows must
  // read as actions at rest, not only on hover.
  const rowClass =
    "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/50"
  const chevron = (
    <HugeiconsIcon
      icon={ArrowRight01Icon}
      strokeWidth={2}
      aria-hidden="true"
      className="size-4 shrink-0 text-brand"
    />
  )

  return (
    <Empty className="gap-4">
      <EmptyHeader>
        <EmptyMedia>
          <Medallion icon={Alert02Icon} size="lg" />
        </EmptyMedia>
        <EmptyTitle>{t("title")}</EmptyTitle>
      </EmptyHeader>
      <div className="flex w-full flex-col gap-1 text-left">
        {!modelApproved && (
          <Link href={chapterHref("approval")} className={rowClass}>
            <span className="min-w-0 truncate">{t("approvalLine")}</span>
            {chevron}
          </Link>
        )}
        {peopleCount === 0 && (
          <Link href="/people/import" className={rowClass}>
            <span className="min-w-0 truncate">{t("importLine")}</span>
            {chevron}
          </Link>
        )}
        {unclassifiedCount > 0 && (
          <Link href="/people/classify" className={rowClass}>
            <span className="min-w-0 truncate">
              {t("classifyLine", { count: unclassifiedCount })}
            </span>
            {chevron}
          </Link>
        )}
        {unevaluatedRoles.length > 0 && (
          <>
            <Link href="/roles" className={rowClass}>
              <span className="min-w-0 truncate">
                {t("evaluateLine", { count: unevaluatedRoles.length })}
              </span>
              {chevron}
            </Link>
            {unevaluatedRoles.slice(0, MAX_ITEMS).map((role) => (
              <Link
                key={role.roleId}
                href={`/roles/${role.slug}`}
                className={`${rowClass} text-muted-foreground text-sm`}
              >
                <span className="min-w-0 truncate">{role.title}</span>
                {chevron}
              </Link>
            ))}
          </>
        )}
      </div>
      {driftedRolesCount > 0 && (
        <PayMappingDriftWarning count={driftedRolesCount} />
      )}
    </Empty>
  )
}
