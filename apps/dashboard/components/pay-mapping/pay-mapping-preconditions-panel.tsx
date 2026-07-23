import { Alert02Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { MAX_ITEMS } from "@/lib/todo"

export interface PreconditionRole {
  roleId: string
  title: string
  slug: string
}

// The plain-language guidance shown in place of the create form while the
// pay-mapping gate is unmet (the guidance rule: preconditions in words,
// never silently disabled). One row per unmet condition, each a full-width
// link to where the work happens; the unevaluated-role rows below the
// evaluate line are capped at MAX_ITEMS, the same cap the to-do uses.
export function PayMappingPreconditionsPanel({
  unclassifiedCount,
  unevaluatedRoles,
}: {
  unclassifiedCount: number
  unevaluatedRoles: PreconditionRole[]
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
        <EmptyMedia variant="icon">
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            aria-hidden="true"
          />
        </EmptyMedia>
        <EmptyTitle>{t("title")}</EmptyTitle>
      </EmptyHeader>
      <div className="flex w-full flex-col gap-1 text-left">
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
    </Empty>
  )
}
