"use client"

import { pdf } from "@react-pdf/renderer"
import { api } from "@workspace/backend/convex/_generated/api"
import type { PraxisAreaKey } from "@workspace/constants"
import { useMutation } from "convex/react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { useOrganization } from "@/components/org-context"
import type { IdentityLabels } from "@/components/pdf/identity-block"
import { computeHeaderBreaks } from "@/components/pdf/pdf-table"
import { resolveCriteriaLibraryValue } from "@/lib/audit-constants"
import { formatMoney } from "@/lib/currency"
import { exportFileLabel } from "@/lib/export-file-name"
import { percentText } from "@/lib/percent"
import { toast } from "@/lib/toast"
import {
  type DetailAppendixLabels,
  DetailAppendixPdf,
  detailAppendixTables,
} from "./detail-appendix-doc"
import type {
  GroupAnalysis,
  PayMappingActionWire,
  PayMappingGapResult,
  PayMappingNoteWire,
  PayMappingRunDetail,
} from "./pay-mapping-gap-types"
import {
  assemblePayMappingReport,
  hourlyNoteLabel,
  type PayMappingReportDoc,
  type ReportPreviousInput,
} from "./pay-mapping-report-data"
import {
  detailAppendixDoc,
  type SigningActionArea,
  type SigningReportDoc,
  signingReportDoc,
} from "./signing-report-data"
import {
  type SigningReportLabels,
  SigningReportPdf,
} from "./signing-report-doc"

// Which of the two documents an export produces (ADR-0030). The signing
// report is the masked samverkan document; the detail appendix the
// unmasked complete documentation.
export type ReportDocumentKind = "signing" | "detail"

// The standalone download's file name, shared with the archive package so
// the bundled document and the standalone one can never drift apart.
export function reportFileName(
  label: string,
  kind: ReportDocumentKind
): string {
  const safe = exportFileLabel(label)
  return kind === "signing"
    ? `${safe}-signeringsrapport.pdf`
    : `${safe}-detaljbilaga.pdf`
}

// Everything one export consumes; the caller owns the fetching (the report
// page reads its run context and subscriptions, the runs list fetches
// one-shot), the hook owns everything after.
export interface ReportExportData {
  run: PayMappingRunDetail
  gap: PayMappingGapResult
  analyses: GroupAnalysis[]
  actions: PayMappingActionWire[]
  notes: PayMappingNoteWire[]
  previous: ReportPreviousInput | null
}

// The multi-pass cap for the appendix's continuation headers. Convergence
// is NOT monotone (an inserted header can push the previous page's last row
// forward, MOVING a break rather than adding one), so there is no guaranteed
// fixed point: typical documents settle in 2 passes, measured
// comparison-heavy ones have needed up to 13. When the cap is hit, the final
// render ships the LAST RENDERED set together with the page refs measured
// under it, never an unrendered guess.
const MAX_PASSES = 16

// The two document exports, shared by the report page's panels and the runs
// list's row menu: assemble the frozen run + work layer once (unmasked),
// project it into the requested document, render it, log the export in the
// audit trail (ADR-0011 p.3: the boundary where data leaves the system) and
// hand the browser the file.
export function usePayMappingReportExport(): {
  busy: boolean
  exportDocument: (
    data: ReportExportData,
    kind: ReportDocumentKind
  ) => Promise<void>
  // The document alone, without the boundary log and the download: the
  // archive package renders the SAME documents through this seam, so the
  // bundled documents can never diverge from the standalone ones. The
  // caller owns busy state and its own boundary event.
  renderDocument: (
    data: ReportExportData,
    kind: ReportDocumentKind
  ) => Promise<Blob>
} {
  const t = useTranslations("dashboard.payMapping.report")
  const tSigning = useTranslations("dashboard.payMapping.signingReport")
  const tDetail = useTranslations("dashboard.payMapping.detailAppendix")
  const tGap = useTranslations("dashboard.payMapping.gap")
  const tActions = useTranslations("dashboard.payMapping.actions")
  const tReasons = useTranslations("dashboard.payMapping.reasons")
  const tReview = useTranslations("dashboard.payMapping.review")
  const tStatus = useTranslations("dashboard.payMapping.analysisStatus")
  // The document-shared labels the metodbilaga already owns (contents,
  // generated-on, criteria table columns): reused, not duplicated.
  const tAppendix = useTranslations("dashboard.model.methodAppendix")
  const format = useFormatter()
  const locale = useLocale()
  const { orgId, name: organizationName } = useOrganization()
  const logSigning = useMutation(
    api.payMapping.report.logPayMappingSigningReportExport
  )
  const logDetail = useMutation(
    api.payMapping.report.logPayMappingDetailAppendixExport
  )
  const [busy, setBusy] = useState(false)

  const praxisAreaLabel = (area: PraxisAreaKey) =>
    tReview(`praxis.${area}.title`)
  const dash = t("maskedCell")

  function assemble(data: ReportExportData): PayMappingReportDoc {
    const { run, gap, analyses, actions, notes, previous } = data
    const currency = gap.currency
    const money = (value: number) =>
      currency === null
        ? format.number(Math.round(value))
        : formatMoney(value, currency, locale)
    return assemblePayMappingReport({
      run,
      gap,
      analyses,
      actions,
      notes,
      previous,
      praxisAreaLabel,
      formatters: {
        money,
        pct: (value) => percentText(value, format),
        date: (epochMs) =>
          format.dateTime(new Date(epochMs), { dateStyle: "medium" }),
        dateTime: (epochMs) =>
          format.dateTime(new Date(epochMs), {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        costUnitSuffix: (unit) =>
          unit === null || unit === "oneOff"
            ? ""
            : tActions(`costUnitSuffix.${unit}`),
      },
    })
  }

  function identityLabels(
    doc: Pick<PayMappingReportDoc, "identity" | "runLabel" | "status">,
    docTitle: string
  ): IdentityLabels {
    return {
      docTitle,
      // The organization's own name, as stored: a pass-through i18n key
      // would only launder a value that needs no translation.
      organizationName,
      runLabel: doc.runLabel,
      referenceDateLine: t("referenceDateLine", {
        date: doc.identity.referenceDate,
      }),
      extractedAtLine: t("extractedAtLine", {
        dateTime: doc.identity.extractedAt,
      }),
      methodVersionLine:
        doc.identity.approvedAt === null
          ? t("methodVersionUnapproved", {
              version: doc.identity.systemVersion,
            })
          : t("methodVersionLine", {
              version: doc.identity.systemVersion,
              date: doc.identity.approvedAt,
            }),
      generatedOn: tAppendix("generatedOn", {
        date: format.dateTime(new Date(), { dateStyle: "medium" }),
      }),
      statusTag: doc.status === "final" ? t("tagFinal") : t("tagDraft"),
    }
  }

  const quartileLabels = [
    t("quartile1"),
    t("quartile2"),
    t("quartile3"),
    t("quartile4"),
  ]

  function signingLabels(doc: SigningReportDoc): SigningReportLabels {
    const docTitle = tSigning("docTitle")
    const share = (value: string | null) => value ?? dash
    const areaLabel = (area: SigningActionArea) =>
      area === "equalWork"
        ? tSigning("areaEqualWork")
        : area === "equivalentWork"
          ? tSigning("areaEquivalentWork")
          : tSigning("areaPraxis")
    const observationLabel = (area: SigningActionArea, count: number) =>
      area === "equalWork"
        ? tSigning("observationEqualWork", { count })
        : area === "equivalentWork"
          ? tSigning("observationEquivalentWork", { count })
          : tSigning("observationPraxis", { count })
    // The action plan's responsible cell is a FUNCTION, never a person: the
    // signing report prints no owner names (the appendix carries them), and
    // the value is a constant of the area, like the observation label.
    const responsibleLabel = (area: SigningActionArea) =>
      area === "praxis"
        ? tSigning("responsiblePraxis")
        : tSigning("responsibleWork")
    const conclusion = (finding: "none" | "found" | null, done: boolean) =>
      !done || finding === null
        ? tSigning("conclusionPending")
        : finding === "found"
          ? tSigning("conclusionReview")
          : tSigning("conclusionClear")
    const collaborationDocumented = doc.checklist.collaborationDocumented
    const nextStep =
      doc.openItems.openAnalyses > 0
        ? tSigning("nextStepOpen")
        : doc.openItems.actionsInProgress > 0
          ? tSigning("nextStepActions", {
              count: doc.openItems.actionsInProgress,
            })
          : tSigning("nextStepDone")
    return {
      footer: docTitle,
      identity: identityLabels(doc, docTitle),
      formalitiesTitle: tSigning("formalitiesTitle"),
      collaborationDateLine:
        doc.collaboration === null || doc.collaboration.date === null
          ? tSigning("collaborationDateMissing")
          : tSigning("collaborationDateLine", { date: doc.collaboration.date }),
      participantsLabel: tReview("collaborationParticipants"),
      descriptionLabel: tReview("collaborationDescription"),
      notDocumented: t("notDocumented"),
      appendixReference: tSigning("appendixReference"),
      signature: {
        employer: tSigning("signatureEmployer"),
        union: tSigning("signatureUnion"),
        name: tSigning("signatureName"),
        signature: tSigning("signatureSignature"),
        place: tSigning("signaturePlace"),
        date: tSigning("signatureDate"),
      },
      summaryTitle: tSigning("summaryTitle"),
      boxes: [
        {
          title: tSigning("boxPayPosition"),
          rows: [
            {
              label: tSigning("payPositionMedian"),
              value: share(doc.payPosition.womenShareOfMenMedianPct),
            },
            {
              label: tSigning("payPositionMean"),
              value: share(doc.payPosition.womenShareOfMenMeanPct),
            },
          ],
        },
        {
          title: tSigning("boxRepresentation"),
          rows: doc.quartiles.map((quartile, index) => ({
            label: quartileLabels[index] ?? "",
            value:
              quartile.women + quartile.men === 0
                ? dash
                : tSigning("representationRow", {
                    share: percentText(
                      (quartile.women / (quartile.women + quartile.men)) * 100,
                      format
                    ),
                  }),
          })),
        },
        {
          title: tSigning("boxEqualWork"),
          rows: [
            {
              label: tSigning("groupsCompared"),
              value: String(doc.equalWork.groups),
            },
            {
              label: tSigning("assessmentsCompleted"),
              value: tSigning("countOf", {
                done: doc.equalWork.assessed,
                total: doc.equalWork.required,
              }),
            },
            {
              label: tSigning("objectiveReasons"),
              value: String(doc.equalWork.objectiveReasons),
            },
            {
              label: tSigning("actionsDecided"),
              value: String(doc.equalWork.actionsDecided),
            },
          ],
        },
        {
          title: tSigning("boxEquivalentWork"),
          rows: [
            {
              label: tSigning("wdInScope"),
              value: String(doc.equivalentWork.womenDominatedGroups),
            },
            {
              label: tSigning("relevantComparisons"),
              value: String(doc.equivalentWork.comparisons),
            },
            {
              label: tSigning("comparisonsAssessed"),
              value: tSigning("countOf", {
                done: doc.equivalentWork.comparisonsAssessed,
                total: doc.equivalentWork.comparisons,
              }),
            },
            {
              label: tSigning("objectiveReasons"),
              value: String(doc.equivalentWork.objectiveReasons),
            },
            {
              label: tSigning("actionsDecided"),
              value: String(doc.equivalentWork.actionsDecided),
            },
          ],
        },
      ],
      quartilesTitle: t("quartilesTitle"),
      quartileRow: (index) => quartileLabels[index] ?? "",
      colWomen: tGap("columns.women"),
      colMen: tGap("columns.men"),
      chartQuartilesCaption: t("chartQuartilesCaption"),
      closingSentences: [
        tSigning("stateSentence", {
          groups: doc.equalWork.groups,
          comparisons: doc.equivalentWork.comparisons,
          open: doc.openItems.openAnalyses,
        }),
        nextStep,
        tSigning("indicatorNote"),
      ],
      scopeTitle: tSigning("scopeTitle"),
      scopeRows: [
        {
          label: tSigning("scopeReferenceDate"),
          value: doc.identity.referenceDate,
        },
        {
          label: tSigning("scopePopulation"),
          value: tSigning("populationValue", {
            total: doc.population.total,
            women: doc.population.women,
            men: doc.population.men,
            priced: doc.population.priced,
          }),
        },
        {
          label: tSigning("scopePayElements"),
          value: tSigning("payElementsValue"),
        },
        {
          label: tSigning("scopeExclusions"),
          value: tSigning("exclusionsValue", {
            withoutPay: doc.exclusions.withoutPay,
            singletons: doc.exclusions.singletonCount,
            genderPure: doc.exclusions.genderPureCount,
          }),
        },
      ],
      confidentialityNote: tSigning("confidentialityNote", {
        count: doc.exclusions.maskedGroupCount,
      }),
      praxisTitle: tSigning("praxisTitle"),
      colArea: tSigning("colArea"),
      colConclusion: tSigning("colConclusion"),
      colFollowUp: tSigning("colFollowUp"),
      praxisRows: [
        ...doc.praxis.map((area) => ({
          area: praxisAreaLabel(area.key),
          conclusion: conclusion(area.finding, area.done),
          followUp:
            area.action === null
              ? dash
              : tSigning("praxisAction", {
                  number: area.action.number,
                  action: area.action.plannedAction,
                  date: area.action.plannedDate,
                }),
        })),
        {
          area: tSigning("collaborationRow"),
          conclusion: collaborationDocumented
            ? tSigning("collaborationPerformed")
            : tSigning("collaborationInProgress"),
          followUp: doc.collaboration?.date ?? dash,
        },
      ],
      equalWorkTitle: tSigning("equalWorkTitle"),
      equalWorkRows: [
        {
          label: tSigning("groupsCompared"),
          value: String(doc.equalWork.groups),
        },
        // The direction split, right under the total the two directions are
        // merged into: the conclusion below states that both are counted, so
        // the reader has to be able to separate them.
        {
          label: tSigning("womenAhead"),
          value: String(doc.equalWork.womenAhead),
        },
        {
          label: tSigning("assessmentsCompleted"),
          value: tSigning("countOf", {
            done: doc.equalWork.assessed,
            total: doc.equalWork.required,
          }),
        },
        {
          label: tSigning("objectiveReasons"),
          value: String(doc.equalWork.objectiveReasons),
        },
        {
          label: tSigning("actionsDecided"),
          value: String(doc.equalWork.actionsDecided),
        },
        {
          label: tSigning("insufficientBasis"),
          value: String(doc.equalWork.insufficientBasis),
        },
      ],
      equalWorkConclusion: tSigning("equalWorkConclusion"),
      equivalentTitle: tSigning("equivalentTitle"),
      chainLine: tSigning("chainLine"),
      equivalentRows: [
        {
          label: tSigning("wdInScope"),
          value: String(doc.equivalentWork.womenDominatedGroups),
        },
        {
          label: tSigning("relevantComparisons"),
          value: String(doc.equivalentWork.comparisons),
        },
        {
          label: tSigning("comparisonsAssessed"),
          value: tSigning("countOf", {
            done: doc.equivalentWork.comparisonsAssessed,
            total: doc.equivalentWork.comparisons,
          }),
        },
        {
          label: tSigning("objectiveReasons"),
          value: String(doc.equivalentWork.objectiveReasons),
        },
        {
          label: tSigning("actionsDecided"),
          value: String(doc.equivalentWork.actionsDecided),
        },
      ],
      actionPlanTitle: tSigning("actionPlanTitle"),
      colObservation: tSigning("colObservation"),
      colActions: tSigning("colActions"),
      colStatusSplit: tSigning("colStatusSplit"),
      colResponsible: tSigning("colResponsible"),
      colCost: tActions("estimatedCost"),
      colDates: tSigning("colDates"),
      // Every area keeps its row, whether or not a measure has been decided
      // for it: the statutory table's action cell reads "a measure or
      // continued assessment", so an area still under analysis reports that
      // rather than vanishing from the plan.
      actionPlanRows: doc.actionPlan.map((row) => ({
        area: areaLabel(row.area),
        observation: observationLabel(row.area, row.observations),
        actions: String(row.count),
        statusSplit:
          row.count > 0
            ? tSigning("statusSplit", {
                notStarted: row.notStarted,
                inProgress: row.inProgress,
                done: row.done,
              })
            : row.observations > 0
              ? tSigning("continuedAssessment")
              : dash,
        responsible: responsibleLabel(row.area),
        cost: row.cost ?? dash,
        dates:
          row.earliest === null || row.latest === null
            ? dash
            : row.earliest === row.latest
              ? row.earliest
              : tSigning("dateRange", {
                  earliest: row.earliest,
                  latest: row.latest,
                }),
      })),
      noActions: t("noActions"),
      methodTitle: tSigning("methodTitle"),
      methodLines: [
        tSigning("methodEqualWork"),
        tSigning("methodEquivalentWork", {
          criteria: doc.method.criteria
            .map((criterion) =>
              tSigning("criterionWithWeight", {
                name: criterion.name,
                points: criterion.weightPoints,
              })
            )
            .join(", "),
        }),
        tSigning("methodPayElements", { currency: doc.currency ?? dash }),
        tSigning("methodAppendixReference"),
      ],
      checklistTitle: tSigning("checklistTitle"),
      checklistRows: [
        {
          label: tSigning("checkAssessed"),
          done: doc.checklist.allRequiredAssessed,
        },
        {
          label: tSigning("checkLinked"),
          done: doc.checklist.reasonsOrActionsLinked,
        },
        {
          label: tSigning("checkCollaboration"),
          done: doc.checklist.collaborationDocumented,
        },
        {
          label: tSigning("checkSameVersion"),
          done: doc.checklist.sameFrozenVersion,
        },
      ],
      checklistDone: tSigning("checklistDone"),
      checklistOpen: tSigning("checklistOpen"),
      maskedCell: dash,
    }
  }

  function detailLabels(doc: PayMappingReportDoc): DetailAppendixLabels {
    const docTitle = tDetail("docTitle")
    // The same resolver the audit log uses for a dimension key: the
    // criteria library's own localized name in the viewer's locale.
    const dimensionLabel = (key: string) =>
      resolveCriteriaLibraryValue("dimensionKey", key, locale) ?? key
    const workingConditionsLine =
      doc.method.workingConditions === null
        ? tDetail("wcNone")
        : tDetail(
            doc.method.workingConditions.status === "active"
              ? "wcMaterial"
              : "wcNotMaterial",
            { motivation: doc.method.workingConditions.motivation }
          )
    return {
      footer: docTitle,
      identity: identityLabels(doc, docTitle),
      classification: tDetail("classification"),
      contentsTitle: tAppendix("contentsTitle"),
      equalWorkTitle: tDetail("equalWorkTitle"),
      equivalentTitle: tDetail("equivalentTitle"),
      equivalentChainLine: tSigning("chainLine"),
      praxisTitle: tDetail("praxisTitle"),
      methodTitle: tDetail("methodTitle"),
      colGroup: tGap("columns.group"),
      colLevel: tGap("columns.level"),
      colWomen: tGap("columns.women"),
      colMen: tGap("columns.men"),
      colTccWomen: tDetail("colTccWomen"),
      colTccMen: tDetail("colTccMen"),
      colTccGapKr: tDetail("colTccGapKr"),
      colTccGapPct: tDetail("colTccGapPct"),
      colStatus: t("colStatus"),
      medianLine: (median) =>
        tDetail("medianLine", {
          women: median.women ?? dash,
          men: median.men ?? dash,
          gap: median.gapPct ?? dash,
        }),
      baseLine: (base) =>
        tDetail("baseLine", {
          women: base.womenMean ?? dash,
          men: base.menMean ?? dash,
          gap: base.gapPct ?? dash,
        }),
      flagLabel: (flag) => tGap(`flag.${flag}`),
      statusLabel: (status) => tStatus(status),
      baseDrivenMarker: "*",
      baseDrivenNote: tDetail("baseDrivenNote"),
      prevYearLine: (gapPct) => t("prevYearLine", { gap: gapPct }),
      reasonsLabel: t("reasonsLabel"),
      noteLabel: t("noteLabel"),
      actionsLabel: tDetail("actionsLabel"),
      reasonLabel: (reason) => tReasons(reason),
      linkedActionLine: (action) =>
        tDetail("linkedAction", {
          number: action.number,
          owner: action.ownerName,
          date: action.plannedDate,
        }),
      undocumented: t("undocumented"),
      levelText: (level) => (level === null ? dash : String(level)),
      emptyEqualWork: t("emptyEqualWork"),
      reverseTitle: t("reverseTitle"),
      genderPureTitle: t("genderPureTitle"),
      genderPureRow: (row) =>
        t("genderPureRow", {
          group: row.label,
          level: row.level ?? dash,
          count: row.count,
          gender: row.gender === "Kvinna" ? t("wordWomen") : t("wordMen"),
        }),
      wdGroupLine: (group) =>
        t("wdGroupLine", {
          group: group.label,
          level: group.level,
          headcount: group.headcount,
          share: group.womenSharePct,
          mean: group.meanComp ?? dash,
          spread: group.spread ?? dash,
        }),
      colComparator: t("colComparator"),
      colHeadcount: tGap("columns.headcount"),
      colWomenShare: tGap("columns.womenShare"),
      colMean: tGap("columns.mean"),
      colSpread: t("colSpread"),
      colDiffPct: tGap("columns.diffPct"),
      colDiffKr: tGap("columns.diffSek"),
      noComparators: tGap("noComparators"),
      emptyWomenDominated: t("emptyWomenDominated"),
      praxisAreaTitle: praxisAreaLabel,
      findingLabel: (finding) =>
        finding === "none"
          ? t("findingNone")
          : finding === "found"
            ? t("findingFound")
            : t("findingPending"),
      praxisActionLine: (action) =>
        tDetail("praxisAction", {
          number: action.number,
          action: action.plannedAction,
          date: action.plannedDate,
        }),
      previousEvaluationTitle:
        doc.previousEvaluation === null
          ? ""
          : tDetail("previousEvaluationTitle", {
              run: doc.previousEvaluation.runLabel,
              date: doc.previousEvaluation.referenceDate,
            }),
      noPreviousActions: t("noPreviousActions"),
      collaborationTitle: tReview("collaborationTitle"),
      participantsLabel: tReview("collaborationParticipants"),
      descriptionLabel: tReview("collaborationDescription"),
      collaborationDateLabel: tReview("collaborationDate"),
      collaborationRemarksLabel: tReview("collaborationRemarks"),
      notDocumented: t("notDocumented"),
      actionsTitle: t("actionsTitle"),
      colNumber: tActions("number"),
      colTarget: tDetail("colTarget"),
      colProblem: t("colAction"),
      colReason: tActions("reason"),
      colOwner: tActions("owner"),
      colDate: tActions("plannedDate"),
      colCost: tActions("estimatedCost"),
      colPriority: tActions("priorityLabel"),
      colActionStatus: t("colStatus"),
      targetKindLabel: (kind) => tActions(`targetKind.${kind}`),
      actionStatusLabel: (status) => tActions(`status.${status}`),
      priorityLabel: (priority) => tActions(`priority.${priority}`),
      erasedContent: tActions("erasedContent"),
      noActions: t("noActions"),
      notesTitle: t("notesTitle"),
      noteTypeLabel: (type) => tActions(`noteType.${type}`),
      noNotes: t("noNotes"),
      definitionsTitle: tDetail("definitionsTitle"),
      // The signing report's own sentence: one wording for "equal work" in
      // both documents. Equivalent work takes the appendix's own string
      // instead, because the signing one inlines the criteria list that the
      // table right below already prints.
      defEqualWork: tSigning("methodEqualWork"),
      defEquivalentWork: tDetail("defEquivalentWork"),
      criteriaTitle: t("criteriaTitle"),
      criterionPurpose: tDetail("criterionPurpose"),
      criterionRelevance: tDetail("criterionRelevance"),
      criterionWeightMotivation: tDetail("criterionWeightMotivation"),
      colCriterion: tAppendix("colCriterion"),
      colDimension: tDetail("colDimension"),
      colWeight: tAppendix("colWeight"),
      colShare: tAppendix("colShare"),
      dimensionLabel,
      pointBudgetLine: t("pointBudgetLine", { points: doc.method.pointBudget }),
      dimensionSharesTitle: tDetail("dimensionSharesTitle"),
      levelRulesTitle: tDetail("levelRulesTitle"),
      colMinScore: tDetail("colMinScore"),
      zoneRulesTitle: tDetail("zoneRulesTitle"),
      zoneRuleLine: (rule) =>
        tDetail("zoneRule", { zone: rule.zone, step: rule.minStep }),
      workingConditionsLine,
      scaleNote: tDetail("scaleNote"),
      differenceNote: tDetail("differenceNote"),
      measuresNote: t("measuresNote", { currency: doc.currency ?? dash }),
      thresholdsNote: tDetail("thresholdsNote"),
      hourlyDefaultLine: tDetail("hourlyDefaultLine", {
        hours: doc.fullTimeHoursDefault,
      }),
      hourlyNote: hourlyNoteLabel(doc, t),
      coverageNote: t("coverageNote", {
        singletons: doc.method.singletonCount,
        genderPure: doc.method.genderPureCount,
        reverse: doc.method.reverseCount,
      }),
      unmaskedNote: tDetail("unmaskedNote"),
      maskedCell: dash,
    }
  }

  async function renderDocument(
    data: ReportExportData,
    kind: ReportDocumentKind
  ): Promise<Blob> {
    const full = assemble(data)
    if (kind === "signing") {
      // Six to eight pages, no long tables and no contents page: one pass.
      const doc = signingReportDoc(full)
      return await pdf(
        <SigningReportPdf doc={doc} labels={signingLabels(doc)} />
      ).toBlob()
    }
    const doc = detailAppendixDoc(full)
    const labels = detailLabels(doc)
    // Multi-pass render: each pass records where every section and table
    // row lands; from that the rows that start a new page get their table's
    // header re-rendered above them (continuation headers), and because an
    // inserted header can itself move later rows, the loop repeats until the
    // layout is stable (or MAX_PASSES is hit, see above).
    let headerBreaks = new Set<string>()
    let pageRefs: Record<string, number> = {}
    const tables = detailAppendixTables(doc)
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const rowPages: Record<string, number> = {}
      const refs: Record<string, number> = {}
      await pdf(
        <DetailAppendixPdf
          doc={doc}
          labels={labels}
          headerBreaks={headerBreaks}
          onResolvePage={(id, page) => {
            refs[id] = page
          }}
          onRowPage={(id, page) => {
            rowPages[id] = page
          }}
        />
      ).toBlob()
      pageRefs = refs
      const next = computeHeaderBreaks(tables, rowPages)
      const stable =
        next.size === headerBreaks.size &&
        [...next].every((id) => headerBreaks.has(id))
      if (stable || pass === MAX_PASSES - 1) break
      headerBreaks = next
    }
    return await pdf(
      <DetailAppendixPdf
        doc={doc}
        labels={labels}
        pageRefs={pageRefs}
        headerBreaks={headerBreaks}
      />
    ).toBlob()
  }

  async function exportDocument(
    data: ReportExportData,
    kind: ReportDocumentKind
  ): Promise<void> {
    setBusy(true)
    try {
      const blob = await renderDocument(data, kind)
      // The export-boundary audit row (ADR-0011 p.3) is written BEFORE the
      // file is handed over: a download the trail does not know about must
      // not happen. Generation stayed local; nothing has left the browser
      // yet.
      try {
        await (kind === "signing"
          ? logSigning({ orgId, runId: data.run.runId })
          : logDetail({ orgId, runId: data.run.runId }))
      } catch {
        toast.error(t("logFailed"))
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = reportFileName(data.run.label, kind)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return { busy, exportDocument, renderDocument }
}
