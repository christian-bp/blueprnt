import { Badge } from "@workspace/ui/components/badge"
import { useTranslations } from "next-intl"

// Send-status to Badge variant. "sent" reads as success (green), "failed" as
// danger (destructive/red); in-flight and cancelled stay neutral. Mirrors the
// backend vSendStatus (platform/emailLog.ts) and the i18n statuses.* keys.
const SEND_VARIANT = {
  queued: "secondary",
  sent: "success",
  failed: "destructive",
  cancelled: "outline",
} as const

export type EmailSendStatus = keyof typeof SEND_VARIANT

export function EmailStatusBadge({ status }: { status: EmailSendStatus }) {
  const t = useTranslations("dashboard.admin.emailLog.statuses")
  return <Badge variant={SEND_VARIANT[status]}>{t(status)}</Badge>
}

// Per-recipient delivery outcome to Badge variant. A reached inbox (delivered)
// reads success; hard failures (bounced/undelivered/stopped) read danger; the
// rest stay neutral while the outcome is still in flight. Mirrors the backend
// vDeliveryStatus and the i18n delivery.status.* keys.
const DELIVERY_VARIANT = {
  pending: "secondary",
  sent: "secondary",
  delivered: "success",
  soft_bounced: "secondary",
  bounced: "destructive",
  undelivered: "destructive",
  stopped: "destructive",
} as const

export type EmailDeliveryStatus = keyof typeof DELIVERY_VARIANT

export function DeliveryStatusBadge({
  status,
}: {
  status: EmailDeliveryStatus
}) {
  const t = useTranslations("dashboard.admin.emailLog.delivery.status")
  return <Badge variant={DELIVERY_VARIANT[status]}>{t(status)}</Badge>
}
