"use client"

import { LockIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { useTranslations } from "next-intl"

// The locked-state badge: shown wherever a role's revealed result is
// displayed (the role page's evaluation card, the role sheet), so a viewer
// can always tell a locked, revealed result apart from a draft. Shared so
// both surfaces read identically (lock-as-reveal, spec 2.4/6).
export function LockedBadge() {
  const t = useTranslations("dashboard.roles.detail")
  return (
    <Badge variant="outline" className="gap-1">
      <HugeiconsIcon
        icon={LockIcon}
        strokeWidth={2}
        aria-hidden="true"
        className="size-3"
      />
      {t("lockedBadge")}
    </Badge>
  )
}

// The derived method-drift chip: a role locked before the model's latest
// approval was rated under a since-superseded method (ADR-0023's
// "bedomd enligt tidigare metod" marking). Purely derived (methodDrift on the
// results wire), never stored; re-locking under the current method clears it.
export function MethodDriftBadge() {
  const t = useTranslations("dashboard.roles.detail")
  return <Badge variant="secondary">{t("methodDriftBadge")}</Badge>
}
