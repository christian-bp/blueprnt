import {
  CheckmarkCircle02Icon,
  CircleIcon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

type ComplianceStatus = "notStarted" | "inProgress" | "documented" | "approved"

// The per-criterion compliance status shown on the Method tab, adapted from the
// polyform table status badge: one outline pill with muted text where the icon
// carries the state (an empty circle for not-started, a pencil while in
// progress, a neutral check once documented, and a success-green check once
// approved). The label is passed in so the badge stays i18n-namespace agnostic.
const STATUS_ICON = {
  notStarted: CircleIcon,
  inProgress: PencilEdit02Icon,
  documented: CheckmarkCircle02Icon,
  approved: CheckmarkCircle02Icon,
} as const

const STATUS_ICON_TONE: Record<ComplianceStatus, string> = {
  notStarted: "text-muted-foreground",
  inProgress: "text-muted-foreground",
  documented: "text-foreground",
  approved: "text-success",
}

export function MethodStatusBadge({
  status,
  label,
}: {
  status: ComplianceStatus
  label: string
}) {
  return (
    <Badge variant="outline" className="gap-1 px-1.5 text-muted-foreground">
      <HugeiconsIcon
        icon={STATUS_ICON[status]}
        strokeWidth={2}
        className={cn(STATUS_ICON_TONE[status])}
      />
      {label}
    </Badge>
  )
}
