"use client"

import { Download01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { pdf } from "@react-pdf/renderer"
import { useQuery } from "convex/react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import {
  MethodAppendix,
  type MethodAppendixLabels,
} from "@/components/pdf/method-appendix"
import { assembleMethodAppendix } from "@/lib/pdf/method-appendix-data"

export function MethodAppendixDownload({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.methodAppendix")
  const tRisk = useTranslations("dashboard.model.method.biasRiskOption")
  const tButton = useTranslations("dashboard.model.method")
  const format = useFormatter()
  const locale = useLocale()
  const data = useQuery(api.evaluationModel.method.getMethodModel, {
    orgId,
    locale,
  })
  const [busy, setBusy] = useState(false)

  async function onExport() {
    if (data === undefined || data === null) return
    setBusy(true)
    try {
      const doc = assembleMethodAppendix(data, {
        biasStatement: t("biasStatement"),
      })
      const now = format.dateTime(new Date(), { dateStyle: "medium" })
      const labels: MethodAppendixLabels = {
        docTitle: t("docTitle"),
        generatedOn: t("generatedOn", { date: now }),
        model: t("model", { name: data.modelName }),
        statusTag: doc.status === "final" ? t("final") : t("draft"),
        methodologyTitle: t("methodologyTitle"),
        methodologyBody: t("methodologyBody"),
        criteriaTitle: t("criteriaTitle"),
        rationaleTitle: t("rationaleTitle"),
        bandsTitle: t("bandsTitle"),
        colCriterion: t("colCriterion"),
        colWeight: t("colWeight"),
        colShare: t("colShare"),
        colBand: t("colBand"),
        colMinScore: t("colMinScore"),
        purpose: t("purpose"),
        whyRelevant: t("whyRelevant"),
        overlap: t("overlap"),
        biasRisk: t("biasRisk"),
        biasComment: t("biasComment"),
        biasAction: t("biasAction"),
        footer: t("docTitle"),
        pointBudget: t("pointBudget", { points: doc.pointBudget }),
        riskLabel: (r) => tRisk(r),
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
      const blob = await pdf(
        <MethodAppendix doc={doc} labels={labels} />
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
    <Button
      onClick={onExport}
      disabled={data === undefined || data === null || busy}
    >
      <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
      {tButton("downloadPdf")}
    </Button>
  )
}
