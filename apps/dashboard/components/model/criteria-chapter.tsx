"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  criteriaLibraryContent,
  LIBRARY_INDUSTRY_HINTS,
} from "@workspace/backend/convex/evaluationModel/criteriaLibrary"
import { clampIndustry } from "@workspace/constants"
import {
  DIMENSION_KEYS,
  DIMENSION_MAX_ACTIVE,
  type DimensionKey,
  MODEL_MAX_CRITERIA,
} from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { HATCH_CLASS } from "@/components/hatch"
import { HelpMorphButton } from "@/components/help-morph-button"
import { DimensionColumn } from "@/components/model/dimension-column"
import { LibraryPickerDialog } from "@/components/model/library-picker-dialog"
import { PlacedCriterionCard } from "@/components/model/placed-criterion-card"
import { modelErrorKey } from "@/lib/model-errors"
import { toast } from "@/lib/toast"

// The grid's geometry, declared once and used by both states, so the loading
// state and the loaded one can never drift into two different grids.
const GRID_CLASS = "grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4"

// The Kriterier chapter: which criteria the company's model is built from.
//
// Four columns, one per dimension (ADR-0021: fixed method law), each holding
// the criteria chosen for it with its own way to add another underneath. The
// columns are a display of the SELECTION and nothing else: no weight row, no
// library list on the page, and no evaluation scale. Choosing is a decision
// with its own dialog, weighting is the next chapter, and the role-facing 1-5
// scale belongs to rating a role.
export function CriteriaChapter({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.criteria")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const locale = useLocale()

  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  // The org's industry drives the "recommended" chips in the picker: a hint
  // from the library's own combination tables, never a selection (the company
  // still chooses and documents its own criteria).
  const settings = useQuery(api.accounts.organization.getOrganizationSettings, {
    orgId,
  })
  const deactivateCriterion = useMutation(
    api.evaluationModel.criteria.deactivateCriterion
  )

  const [removing, setRemoving] = useState<string | null>(null)

  if (model === undefined) return <CriteriaChapterSkeleton />
  if (model === null) return null

  const industry = settings?.industry ?? null
  const recommendedKeys: readonly string[] =
    industry === null ? [] : LIBRARY_INDUSTRY_HINTS[clampIndustry(industry)]
  const selected = model.criteria.map((criterion) => ({
    libraryKey: criterion.libraryKey,
    name: criterion.name,
  }))

  const countIn = (dimensionKey: DimensionKey) =>
    model.criteria.filter(
      (criterion) => criterion.dimensionKey === dimensionKey
    ).length
  const modelFull = model.criteria.length >= MODEL_MAX_CRITERIA

  // Why this dimension can take nothing more, in words. A flow states its
  // preconditions rather than silently refusing (the backend enforces the same
  // two caps); which bound is binding decides which sentence is true.
  function capReason(dimensionKey: DimensionKey): string | undefined {
    if (countIn(dimensionKey) >= DIMENSION_MAX_ACTIVE[dimensionKey]) {
      return t("capDimension", { max: DIMENSION_MAX_ACTIVE[dimensionKey] })
    }
    if (modelFull) return t("capModel", { max: MODEL_MAX_CRITERIA })
    return undefined
  }

  async function onRemove(criterionId: Id<"criteria">) {
    setRemoving(criterionId)
    try {
      await deactivateCriterion({ orgId, criterionId })
      toast.success(tToast("criterionRemoved"))
    } catch (error) {
      const known = modelErrorKey(error)
      toast.error(known === undefined ? tToast("error") : tErrors(known))
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className={GRID_CLASS}>
      {model.dimensions.map((dimension) => {
        const placed = model.criteria.filter(
          (criterion) => criterion.dimensionKey === dimension.key
        )
        const closed = capReason(dimension.key)
        return (
          <DimensionColumn
            key={dimension.key}
            title={dimension.name}
            helpBody={dimension.question}
            count={placed.length}
            max={DIMENSION_MAX_ACTIVE[dimension.key]}
            full={closed !== undefined}
            action={
              closed === undefined ? (
                <LibraryPickerDialog
                  orgId={orgId}
                  dimensionKey={dimension.key}
                  dimensionName={dimension.name}
                  selected={selected}
                  recommendedKeys={recommendedKeys}
                />
              ) : (
                // The cap replaces the control it closes rather than sitting
                // beside a disabled one: a button that cannot be pressed says
                // nothing about why, and the sentence says both.
                <p className="text-muted-foreground text-xs">{closed}</p>
              )
            }
          >
            {placed.length === 0
              ? undefined
              : placed.map((criterion) => (
                  <PlacedCriterionCard
                    key={criterion.criterionId}
                    criterion={criterion}
                    removing={removing === criterion.criterionId}
                    onRemove={() => onRemove(criterion.criterionId)}
                  />
                ))}
          </DimensionColumn>
        )
      })}
    </div>
  )
}

// One column while the model loads: the dimension's box with its hatch, over
// the real add control. Everything that is NOT data (the dashed frame, the
// dimension's name, its help, the add button's label) is real; only the count
// chip is a bar, because how many criteria this dimension holds is precisely
// what is being waited for.
function ColumnSkeleton({
  title,
  helpBody,
}: {
  title: string
  helpBody: string
}) {
  const t = useTranslations("dashboard.model.criteria")
  const tHelp = useTranslations("dashboard.help")
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-dashed p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-1 font-medium text-sm">
            <span className="truncate">{title}</span>
            <HelpMorphButton label={tHelp("dimensionLabel")}>
              {helpBody}
            </HelpMorphButton>
          </h3>
          {/* The count chip's box: a Badge is h-5 and pill-shaped. */}
          <Skeleton className="h-5 w-20 shrink-0 rounded-4xl" />
        </div>
        <div className="mt-3">
          <div
            aria-hidden="true"
            className={`h-16 w-full rounded-md ${HATCH_CLASS}`}
          />
        </div>
      </div>
      {/* Static chrome with a static label, so it renders as itself, muted and
          inert: whether this dimension still has room is the unknown, so it
          cannot be live. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        tabIndex={-1}
        className="pointer-events-none text-muted-foreground/50"
      >
        {t("addCta")}
      </Button>
    </div>
  )
}

// The chapter's loading state: the same four-column grid, with the four
// dimensions real (they are fixed method law, ADR-0021, and their names and
// guiding questions are locale-keyed library constants, not org data).
export function CriteriaChapterSkeleton() {
  const locale = useLocale()
  const content = criteriaLibraryContent(locale)
  return (
    <div className={GRID_CLASS}>
      {DIMENSION_KEYS.map((key) => (
        <ColumnSkeleton
          key={key}
          title={content.dimensions[key].name}
          helpBody={content.dimensions[key].question}
        />
      ))}
    </div>
  )
}
