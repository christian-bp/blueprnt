"use client"

import { Download01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useTranslations } from "next-intl"
import dynamic from "next/dynamic"
import type { ReactNode } from "react"
import { CHAPTER_ACTION_BUTTON_SIZE } from "@/components/chapter-action-slot"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SubmitButton } from "@/components/submit-button"

// The document card's chrome, shared by the loading shell below and the
// wired download card so the two states can never drift apart (the
// skeleton-matches-loaded rule): title, concept help, and the action slot.
export function ReportCardChrome({ action }: { action: ReactNode }) {
  const t = useTranslations("dashboard.payMapping.report")
  const tHelp = useTranslations("dashboard.help")
  return (
    <Card>
      <CardHeader className="items-center">
        <CardTitle className="flex items-center gap-1.5">
          {t("docTitle")}
          <HelpMorphButton label={tHelp("payMappingReportLabel")}>
            {tHelp("payMappingReportBody")}
          </HelpMorphButton>
        </CardTitle>
        <CardAction className="row-span-1 flex items-center gap-2 self-center">
          {action}
        </CardAction>
      </CardHeader>
    </Card>
  )
}

export function ReportDownloadButton({
  busy,
  disabled,
  onClick,
}: {
  busy: boolean
  disabled: boolean
  onClick?: () => void
}) {
  const t = useTranslations("dashboard.payMapping.report")
  return (
    <SubmitButton
      type="button"
      size={CHAPTER_ACTION_BUTTON_SIZE}
      isSubmitting={busy}
      disabled={disabled}
      {...(onClick === undefined ? {} : { onClick })}
    >
      <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
      {t("downloadReport")}
    </SubmitButton>
  )
}

// The machine-readable key-figures export beside the report: the secondary
// action, outline so the statutory document stays the primary read.
export function MetricsDownloadButton({
  busy,
  disabled,
  onClick,
}: {
  busy: boolean
  disabled: boolean
  onClick?: () => void
}) {
  const t = useTranslations("dashboard.payMapping.report")
  return (
    <SubmitButton
      type="button"
      variant="outline"
      size={CHAPTER_ACTION_BUTTON_SIZE}
      isSubmitting={busy}
      disabled={disabled}
      {...(onClick === undefined ? {} : { onClick })}
    >
      {t("downloadMetrics")}
    </SubmitButton>
  )
}

// The dynamic import's loading state renders the card's REAL chrome (title,
// help, download button: all static i18n), so nothing shifts when the wired
// card mounts. The button starts disabled exactly like the loaded card's
// initial state (data not ready yet), so there is no enabled-to-disabled
// flash either.
function ReportCardShell() {
  return (
    <ReportCardChrome
      action={
        <>
          <MetricsDownloadButton busy={false} disabled />
          <ReportDownloadButton busy={false} disabled />
        </>
      }
    />
  )
}

// Loaded on demand: @react-pdf/renderer is the app's heaviest client
// dependency, and the export is one button pressed rarely (the metodbilaga
// precedent).
const PayMappingReportDownload = dynamic(
  () =>
    import("./pay-mapping-report-download").then(
      (m) => m.PayMappingReportDownload
    ),
  { ssr: false, loading: ReportCardShell }
)

// The Report sub-page: the statutory documentation as a first-class document
// card (name, concept help, draft status, PDF export).
export function PayMappingReport() {
  return <PayMappingReportDownload />
}
