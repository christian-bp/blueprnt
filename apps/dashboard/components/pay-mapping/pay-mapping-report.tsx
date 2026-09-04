"use client"

import {
  Download01Icon,
  FileZipIcon,
  Pdf01Icon,
  Xls01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@workspace/ui/components/frame"
import { useTranslations } from "next-intl"
import dynamic from "next/dynamic"
import type { ReactNode } from "react"
import { CHAPTER_ACTION_BUTTON_SIZE } from "@/components/chapter-action-slot"
import { HelpMorphButton } from "@/components/help-morph-button"
import { Medallion } from "@/components/medallion"
import { SubmitButton } from "@/components/submit-button"

// The report page's outer frame (the Verve card-in-card anatomy): a muted
// frame whose header names the surface, with one white panel per
// downloadable document. Shared by the loading shell below and the wired
// page so the two states can never drift apart (the skeleton-matches-loaded
// rule). `status` is the header's right slot: the draft caveat once the run
// is known.
export function ReportsFrame({
  status,
  children,
}: {
  status?: ReactNode
  children: ReactNode
}) {
  const t = useTranslations("dashboard.payMapping.report")
  return (
    <Frame spacing="sm">
      <FrameHeader className="flex-row items-center justify-between gap-2">
        <FrameTitle>{t("reportsTitle")}</FrameTitle>
        {status}
      </FrameHeader>
      {children}
    </Frame>
  )
}

// One document's panel: the file-type chip and what the document is on the
// left (name, concept help, one identifying line), its download on the
// right. The action slot is fixed-size chrome, so swapping a disabled
// button for a wired one never reflows the row.
function ReportPanel({
  icon,
  title,
  help,
  description,
  action,
}: {
  icon: IconSvgElement
  title: ReactNode
  help?: ReactNode
  description: ReactNode
  action: ReactNode
}) {
  return (
    <FramePanel className="flex flex-row flex-wrap items-center gap-x-4 gap-y-3">
      {/* Brand, not muted: every download here is a document the reader
          came for, and with the four actions sharing one neutral variant
          the chip is what carries the page's accent. */}
      <Medallion icon={icon} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5 font-medium text-sm">
          {title}
          {help}
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
      </div>
      <div className="flex items-center">{action}</div>
    </FramePanel>
  )
}

// The signing report's panel: the primary document, its concept explained
// by its own help.
export function SigningDocumentPanel({ action }: { action: ReactNode }) {
  const t = useTranslations("dashboard.payMapping.report")
  const tHelp = useTranslations("dashboard.help")
  return (
    <ReportPanel
      icon={Pdf01Icon}
      title={t("signingTitle")}
      help={
        <HelpMorphButton label={tHelp("signingReportLabel")}>
          {tHelp("signingReportBody")}
        </HelpMorphButton>
      }
      description={t("signingDescription")}
      action={action}
    />
  )
}

// The machine-readable key-figures workbook's panel.
export function MetricsDocumentPanel({ action }: { action: ReactNode }) {
  const t = useTranslations("dashboard.payMapping.report")
  return (
    <ReportPanel
      icon={Xls01Icon}
      title={t("metricsSheetTitle")}
      description={t("metricsDescription")}
      action={action}
    />
  )
}

// The detail appendix's panel: unmasked and available to every member; the
// help says so and that every download is recorded (ADR-0030).
export function DetailDocumentPanel({ action }: { action: ReactNode }) {
  const t = useTranslations("dashboard.payMapping.report")
  const tHelp = useTranslations("dashboard.help")
  return (
    <ReportPanel
      icon={Pdf01Icon}
      title={t("detailTitle")}
      help={
        <HelpMorphButton label={tHelp("detailAppendixLabel")}>
          {tHelp("detailAppendixBody")}
        </HelpMorphButton>
      }
      description={t("detailDescription")}
      action={action}
    />
  )
}

// The panel buttons say only "Download": the panel already names the
// document, and the full label would crowd the half-width row. The full
// name stays as the accessible name (it contains the visible text, so the
// label-in-name rule holds); the runs list's row menu keeps the long labels.
// The archive package's panel (ADR-0011 p.4): the whole kartläggning as
// one retained bundle, its retention advice carried by its help.
export function ArchiveDocumentPanel({ action }: { action: ReactNode }) {
  const t = useTranslations("dashboard.payMapping.report")
  const tHelp = useTranslations("dashboard.help")
  return (
    <ReportPanel
      icon={FileZipIcon}
      title={t("archiveTitle")}
      help={
        <HelpMorphButton label={tHelp("archivePackageLabel")}>
          {tHelp("archivePackageBody")}
        </HelpMorphButton>
      }
      description={t("archiveDescription")}
      action={action}
    />
  )
}

// The archive export.
export function ArchiveDownloadButton({
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
      aria-label={t("downloadArchive")}
      {...(onClick === undefined ? {} : { onClick })}
    >
      <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
      {t("download")}
    </SubmitButton>
  )
}

// The signing report's export. Every document on this page is a peer: the
// reader picks the one their errand needs, and a lone primary would read as
// a recommended path where there is none. The four buttons therefore share
// one variant.
export function SigningDownloadButton({
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
      aria-label={t("downloadSigning")}
      {...(onClick === undefined ? {} : { onClick })}
    >
      <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
      {t("download")}
    </SubmitButton>
  )
}

// The detail appendix's export.
export function DetailDownloadButton({
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
      aria-label={t("downloadDetail")}
      {...(onClick === undefined ? {} : { onClick })}
    >
      <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
      {t("download")}
    </SubmitButton>
  )
}

// The key-figures export.
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
      aria-label={t("downloadMetrics")}
      {...(onClick === undefined ? {} : { onClick })}
    >
      <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
      {t("download")}
    </SubmitButton>
  )
}

// The dynamic import's loading state renders the frame's REAL chrome (title,
// help, descriptions, download buttons: all static i18n), so nothing shifts
// when the wired page mounts. The buttons start disabled exactly like the
// loaded page's initial state (data not ready yet), so there is no
// enabled-to-disabled flash either.
function ReportCardShell() {
  return (
    <ReportsFrame>
      <SigningDocumentPanel
        action={<SigningDownloadButton busy={false} disabled />}
      />
      <DetailDocumentPanel
        action={<DetailDownloadButton busy={false} disabled />}
      />
      <MetricsDocumentPanel
        action={<MetricsDownloadButton busy={false} disabled />}
      />
      <ArchiveDocumentPanel
        action={<ArchiveDownloadButton busy={false} disabled />}
      />
    </ReportsFrame>
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

// The Report sub-page: the run's downloadable documents as one frame, a
// panel per document: the signing report, the detail appendix, the
// key-figures workbook, the archive package.
export function PayMappingReport() {
  return <PayMappingReportDownload />
}
