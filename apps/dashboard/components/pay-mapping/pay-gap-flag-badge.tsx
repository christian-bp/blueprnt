"use client"

import type { PayGapFlag } from "@workspace/core"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"

// Traffic-light severity chip for a gender-gap group (ADR-0012). A deliberate
// custom indicator: severity is not one of the shadcn Badge variants, so each
// flag maps to a tinted className here (the single place the mapping lives).
// `critical`/`ok` keep the app's destructive/success TINT background
// (bg-x/10, dark:bg-x/20) but use dedicated `flag-critical`/`flag-ok` text
// tokens instead of the shared Badge `text-destructive`/`text-success`
// tokens, which measure below the 4.5:1 AA bar on their own pale tint in
// light mode (see docs/go-live-checklist.md). `elevated` has no built-in
// Badge variant (no amber/warning token in the base system), so it mirrors
// the same tinted pattern with the `flag-elevated` token. `insufficient`
// stays the plain secondary Badge variant (no severity tint). The color
// encodes state in form; the text label keeps it legible without relying on
// color alone.
const FLAG_CLASSNAME: Record<PayGapFlag, string> = {
  critical:
    "border-transparent bg-destructive/10 text-flag-critical dark:bg-destructive/20",
  ok: "border-transparent bg-success/10 text-flag-ok dark:bg-success/20",
  elevated:
    "border-transparent bg-flag-elevated/10 text-flag-elevated dark:bg-flag-elevated/20",
  insufficient: "",
}

export function PayGapFlagBadge({ flag }: { flag: PayGapFlag }) {
  const t = useTranslations("dashboard.payMapping.gap")
  const label = t(`flag.${flag}`)

  if (flag === "insufficient") {
    return (
      <Badge data-flag={flag} variant="secondary">
        {label}
      </Badge>
    )
  }

  return (
    <Badge data-flag={flag} className={cn(FLAG_CLASSNAME[flag])}>
      {label}
    </Badge>
  )
}
