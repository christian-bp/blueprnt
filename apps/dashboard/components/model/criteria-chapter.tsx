"use client"

import { PlusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
import { WorkingConditionsDecision } from "@/components/model/working-conditions-decision"
import { modelErrorKey } from "@/lib/model-errors"
import { toast } from "@/lib/toast"

// The grid's geometry, declared once and used by both states, so the loading
// state and the loaded one can never drift into two different grids.
//
// Four across begins at 2xl, not xl: at a 1440-class laptop width the four
// columns compress to about 272px each and the criterion titles wrap hard,
// while the 2x2 arrangement at those widths reads comfortably. From 1536 up
// there is room for four, and the section runs the full viewport width to give
// it to them.
const GRID_CLASS = "grid items-start gap-4 sm:grid-cols-2 2xl:grid-cols-4"

// Each dimension's help body, which says what the dimension COVERS rather than
// asking the reader a question: a column heading with a question mark behind it
// left the reader to answer it themselves, when what they needed was the list
// of things this dimension is for. A total Record, so a fifth dimension could
// not compile without its own body.
const DIMENSION_HELP_BODY = {
  competence: "dimensionCompetenceBody",
  effort: "dimensionEffortBody",
  responsibility: "dimensionResponsibilityBody",
  workingConditions: "dimensionWorkingConditionsBody",
} as const satisfies Record<DimensionKey, string>

// The Kriterier chapter: which criteria the company's model is built from.
//
// Four columns, one per dimension (ADR-0021: fixed method law), each holding
// the criteria chosen for it with its own way to add another underneath. The
// columns are a display of the SELECTION and nothing else: no weight row, no
// library list on the page, and no evaluation scale. Choosing is a decision
// with its own dialog, weighting is the next chapter, and the role-facing 1-5
// scale belongs to rating a role.
export function CriteriaChapter({ orgId }: { orgId: string }) {
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const tHelp = useTranslations("dashboard.help")
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

  // Whether this dimension can take another criterion at all: its own cap, or
  // the model's 6-8 ceiling, whichever binds first. The backend enforces both
  // regardless; this only decides whether the column offers its add row.
  const hasRoom = (dimensionKey: DimensionKey) =>
    !modelFull && countIn(dimensionKey) < DIMENSION_MAX_ACTIVE[dimensionKey]

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

  // The materiality decision, and what it does to the fourth column. Read from
  // the chapter's own model query, so the column costs no second subscription.
  //
  // The criterion SLOT exists only under an active decision. Before one the
  // column is the materiality question and nothing else: no empty slot, and no
  // way to reach the picker, so "this dimension is material" and "a criterion
  // belongs here" are one state rather than two things a reader has to
  // connect. Answering "not material" settles the dimension and the slot never
  // opens at all.
  const decision = model.workingConditions
  const slotOpen = decision?.status === "active"

  return (
    <div className={GRID_CLASS}>
      {model.dimensions.map((dimension) => {
        const placed = model.criteria.filter(
          (criterion) => criterion.dimensionKey === dimension.key
        )
        const isWorkingConditions = dimension.key === "workingConditions"
        const room =
          hasRoom(dimension.key) && (!isWorkingConditions || slotOpen)
        return (
          <DimensionColumn
            key={dimension.key}
            title={dimension.name}
            helpBody={tHelp(DIMENSION_HELP_BODY[dimension.key])}
            count={placed.length}
            max={DIMENSION_MAX_ACTIVE[dimension.key]}
            full={!room}
            // The hatch IS the empty slot, so it appears exactly when the slot
            // does: under an active decision with nothing chosen yet. Before
            // any answer the question stands in its place, and after "not
            // material" the documented decision does.
            explained={isWorkingConditions && !slotOpen}
            // The decision rides in the column it is about, in every one of
            // its states: the question while nothing is recorded, and the
            // decision once something is. The other three dimensions carry no
            // decision at all.
            note={
              isWorkingConditions ? (
                <WorkingConditionsDecision
                  orgId={orgId}
                  decision={decision}
                  // The dimension caps at one, so the first placed criterion
                  // is the criterion: the decision block needs it by name and
                  // by id, because answering "not material" is an offer to
                  // remove it rather than an instruction to go and do it.
                  criterion={placed[0] ?? null}
                />
              ) : undefined
            }
            action={
              room ? (
                <LibraryPickerDialog
                  orgId={orgId}
                  dimensionKey={dimension.key}
                  dimensionName={dimension.name}
                  selected={selected}
                  recommendedKeys={recommendedKeys}
                />
              ) : undefined
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
      {/* The column's own add row, in the same slot the loaded column puts it:
          static chrome with a static label, so it renders as itself, muted and
          inert. Whether this dimension still has room is the unknown, so it
          cannot be live. */}
      <div className="mt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          tabIndex={-1}
          className="pointer-events-none w-full justify-start text-muted-foreground/50"
        >
          <HugeiconsIcon
            icon={PlusSignIcon}
            strokeWidth={2}
            aria-hidden="true"
          />
          {t("addCta")}
        </Button>
      </div>
    </div>
  )
}

// The chapter's loading state: the same four-column grid, with the four
// dimensions real (they are fixed method law, ADR-0021, their names are
// locale-keyed library constants and their help bodies are the app's own copy,
// so neither waits on org data).
function CriteriaChapterSkeleton() {
  const locale = useLocale()
  const tHelp = useTranslations("dashboard.help")
  const content = criteriaLibraryContent(locale)
  return (
    <div className={GRID_CLASS}>
      {DIMENSION_KEYS.map((key) => (
        <ColumnSkeleton
          key={key}
          title={content.dimensions[key].name}
          helpBody={tHelp(DIMENSION_HELP_BODY[key])}
        />
      ))}
    </div>
  )
}
