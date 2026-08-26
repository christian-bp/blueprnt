"use client"

import { Download01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  criteriaLibraryContent,
  criterionAnchors,
} from "@workspace/backend/convex/evaluationModel/criteriaLibrary"
import { zoneContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import { ZONE_KEYS } from "@workspace/core"
import { pdf } from "@react-pdf/renderer"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import {
  MethodAppendix,
  type MethodAppendixLabels,
} from "@/components/pdf/method-appendix"
import { CHAPTER_ACTION_BUTTON_SIZE } from "@/components/chapter-action-slot"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SubmitButton } from "@/components/submit-button"
import { assembleMethodAppendix } from "@/lib/pdf/method-appendix-data"

export function MethodAppendixDownload({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.methodAppendix")
  const tRisk = useTranslations("dashboard.model.method.biasRiskOption")
  const tButton = useTranslations("dashboard.model.method")
  const tLevels = useTranslations("dashboard.levels")
  const tHelp = useTranslations("dashboard.help")
  const format = useFormatter()
  const locale = useLocale()
  const data = useQuery(api.evaluationModel.method.getMethodModel, {
    orgId,
    locale,
  })
  const [busy, setBusy] = useState(false)
  // The document's status, shown on the card exactly as the PDF's own cover
  // computes it: FINAL once every criterion's protokoll is reviewed and
  // approved, DRAFT until then.
  const final =
    data != null &&
    data.progress.total > 0 &&
    data.progress.approved === data.progress.total

  async function onExport() {
    if (data === undefined || data === null) return
    setBusy(true)
    try {
      const library = criteriaLibraryContent(locale)
      const zones = zoneContent(locale)
      const doc = assembleMethodAppendix(
        data,
        {
          sharedScale: library.sharedScale,
          midpoints: library.midpoints,
          anchorsByKey: Object.fromEntries(
            data.criteria.map((criterion) => {
              const entry = library.criteria[criterion.libraryKey]
              return [
                criterion.libraryKey,
                entry === undefined ? [] : criterionAnchors(entry),
              ]
            })
          ),
        },
        Object.fromEntries(
          ZONE_KEYS.map((zone) => [zone, zones.zones[zone].name])
        ) as Record<(typeof ZONE_KEYS)[number], string>,
        {
          biasStatement: t("biasStatement"),
        }
      )
      const now = format.dateTime(new Date(), { dateStyle: "medium" })
      const labels: MethodAppendixLabels = {
        docTitle: t("docTitle"),
        contentsTitle: t("contentsTitle"),
        generatedOn: t("generatedOn", { date: now }),
        model: t("model", { name: data.modelName }),
        statusTag: doc.status === "final" ? t("final") : t("draft"),
        methodologyTitle: t("methodologyTitle"),
        methodologyBody: t("methodologyBody"),
        scaleTitle: t("scaleTitle"),
        midpointNote: t("midpointNote"),
        criteriaTitle: t("criteriaTitle"),
        rationaleTitle: t("rationaleTitle"),
        zonesTitle: t("zonesTitle"),
        materialityTitle: t("materialityTitle"),
        colCriterion: t("colCriterion"),
        colWeight: t("colWeight"),
        colShare: t("colShare"),
        colLevel: t("colLevel"),
        colMinScore: t("colMinScore"),
        definition: t("definition"),
        anchorsLabel: t("anchorsLabel"),
        purpose: t("purpose"),
        whyRelevant: t("whyRelevant"),
        overlap: t("overlap"),
        biasRisk: t("biasRisk"),
        biasComment: t("biasComment"),
        biasAction: t("biasAction"),
        footer: t("docTitle"),
        pointBudget: t("pointBudget", { points: doc.pointBudget }),
        motivationLabel: t("motivationLabel"),
        riskLabel: (r) => tRisk(r),
        zoneHeading: (zone) =>
          t("zoneHeading", {
            zone: tLevels("zoneLabel", { zone: zone.key }),
            name: zone.name,
            from: zone.levels[0]?.level ?? 0,
            to: zone.levels.at(-1)?.level ?? 0,
          }),
        zoneProfileLine: (minStep) =>
          minStep === null
            ? t("zoneNoProfile")
            : t("zoneProfile", { step: minStep }),
        materialityLine: (wc) =>
          wc === null
            ? t("materialityNone")
            : t(
                wc.status === "active"
                  ? "materialityMaterial"
                  : "materialityNotMaterial",
                {
                  date: format.dateTime(new Date(wc.decidedAt), {
                    dateStyle: "medium",
                  }),
                }
              ),
        approval: (c) =>
          c.status === "approved" && c.decidedByName && c.decidedAt
            ? t("approvedBy", {
                name: c.decidedByName,
                date: format.dateTime(new Date(c.decidedAt), {
                  dateStyle: "medium",
                }),
              })
            : c.status === "documented"
              ? t("notApproved")
              : t("notDocumented"),
      }
      // Two-pass render: pass 1 records where each section and criterion lands,
      // pass 2 renders the final PDF with those page numbers in the contents.
      const pageRefs: Record<string, number> = {}
      await pdf(
        <MethodAppendix
          doc={doc}
          labels={labels}
          onResolvePage={(id, page) => {
            pageRefs[id] = page
          }}
        />
      ).toBlob()
      const blob = await pdf(
        <MethodAppendix doc={doc} labels={labels} pageRefs={pageRefs} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${data.modelName}-metodbilaga.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    // THE DOCUMENT IS A THING, not a stray button: a card that names the
    // metodbilaga, carries its concept help and its live status, and offers
    // the export as the card's action. A bare "download as PDF" button said
    // how without saying what.
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          {t("docTitle")}
          <HelpMorphButton label={tHelp("methodAppendixLabel")}>
            {tHelp("methodAppendixBody")}
          </HelpMorphButton>
        </CardTitle>
        <CardAction className="flex items-center gap-2">
          {data != null && (
            <Badge variant={final ? "success" : "outline"}>
              {final ? t("statusFinal") : t("statusDraft")}
            </Badge>
          )}
          <SubmitButton
            type="button"
            size={CHAPTER_ACTION_BUTTON_SIZE}
            isSubmitting={busy}
            disabled={data === undefined || data === null}
            onClick={onExport}
          >
            <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
            {tButton("downloadPdf")}
          </SubmitButton>
        </CardAction>
      </CardHeader>
    </Card>
  )
}
