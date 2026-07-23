"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useTranslations } from "next-intl"
import Link from "next/link"

// The compact "continue the review" affordance shared by the analysis
// summary's heading row and the overview journey card: label + the
// remaining count in brand + a chevron, as a bordered item. The full
// remaining-steps sentence rides along as the aria-label, so assistive tech
// hears the whole story while the visible item stays terse.
export function ContinueReviewItem({
  href,
  remaining,
}: {
  href: string
  remaining: number
}) {
  const t = useTranslations("dashboard.payMapping.review")
  return (
    <Link
      href={href}
      aria-label={t("remainingBanner", { count: remaining })}
      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
    >
      <span className="font-medium">{t("continueWizard")}</span>
      <span className="text-brand tabular-nums">{remaining}</span>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        strokeWidth={2}
        aria-hidden="true"
        className="size-4 text-brand"
      />
    </Link>
  )
}
