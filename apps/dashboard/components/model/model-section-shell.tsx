"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import NumberFlow from "@number-flow/react"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { ChapterActionSlotProvider } from "@/components/chapter-action-slot"
import {
  FloatingStack,
  FloatingStackProvider,
} from "@/components/floating-stack"
import { ModelChapterTabs } from "@/components/model/model-chapter-tabs"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SectionTitleRow } from "@/components/section-title-row"
import { StageEyebrow } from "@/components/stage-eyebrow"
import { SegmentedProgress } from "@/components/segmented-progress"
import { useOrganization } from "@/components/org-context"
import {
  currentChapter,
  MODEL_CHAPTERS,
  modelChapterProgress,
  type ModelProgressInput,
  modelProgress,
} from "@/lib/model-chapters"

// The model section's shared chrome, mounted by model/layout.tsx so it
// persists across every chapter page. The spine therefore renders ONCE for the
// whole section: never repeated per page, never re-fetched, and never flashing
// a skeleton on a chapter switch.
//
// One query for all four chapters' progress. getMethodChecks already carries
// everything the derivation needs (the twelve checks, the materiality one
// among them, and the approval), so the section's standing readout costs one
// subscription rather than one per chapter.
export function ModelSectionShell({ children }: { children: ReactNode }) {
  const { orgId } = useOrganization()
  const t = useTranslations("dashboard.model.chapters")
  // The section-level namespace, for the stage label: it names the whole
  // model area, not this chapter row.
  const tModel = useTranslations("dashboard.model")
  const tHelp = useTranslations("dashboard.help")
  const pathname = usePathname()
  const data = useQuery(api.evaluationModel.approval.getMethodChecks, { orgId })
  const active = currentChapter(pathname)

  // No model yet reads as nothing decided, not as no bar: an org that has not
  // started still has the same four chapters ahead of it, and the empty bar is
  // what says so.
  const input: ModelProgressInput =
    data === undefined || data === null
      ? { checks: [], approved: false, weightsSaved: false }
      : {
          checks: data.checks,
          approved: data.approval !== null,
          weightsSaved: data.weightsSaved,
        }
  const overall = modelProgress(input)
  // Each chapter's own done/total, in chapter order, for the instrument's
  // segments and the count under the open one.
  const chapters = MODEL_CHAPTERS.map((chapter) => ({
    key: chapter,
    ...modelChapterProgress(input, chapter),
  }))
  // The chapters' own names, resolved where the key is still typed: the
  // instrument hands its callbacks a plain ProgressSegment, whose key is a
  // bare string because the kartläggning's chapters are not this section's.
  const nameFor = new Map<string, string>(
    MODEL_CHAPTERS.map((chapter) => [chapter, t(chapter)])
  )

  return (
    // Two slots the chapter fills from its own tree: its action, which lands
    // on the journey row, and its pills, which land in the floating stack.
    <ChapterActionSlotProvider>
      <FloatingStackProvider>
        <div className="space-y-4">
          {/* The section's title and its one explainer, with the whole
              model's instrument centred on the page beside them. */}
          <SectionTitleRow
            eyebrow={<StageEyebrow label={tModel("stageEyebrow")} />}
            heading={t("heading")}
            help={
              <HelpMorphButton label={tHelp("modelProgressLabel")}>
                {tHelp("modelProgressBody")}
              </HelpMorphButton>
            }
            instrument={
              <SegmentedProgress
                activeSegment={active}
                barLabel={t("progressBarLabel")}
                // A chapter reaching its own done/total plays the same
                // celebration a finished to-do card does. The kartläggning's
                // analysis section does not opt in.
                celebrateOnComplete
                // The one query this section's whole progress derives from.
                // While it is in flight the input above is a placeholder with
                // no checks, so every chapter reads incomplete; saying so here
                // is what stops arriving at a finished chapter counting as
                // finishing it.
                inputReady={data !== undefined}
                done={overall.done}
                renderTitle={(segment) =>
                  nameFor.get(segment.key) ?? segment.key
                }
                renderCount={(segment) =>
                  t.rich("countRich", {
                    done: () => <NumberFlow value={segment.done} />,
                    total: () => <NumberFlow value={segment.total} />,
                  })
                }
                segments={chapters}
                total={overall.total}
              />
            }
          />
          {/* The journey row: the tabs and this chapter's action. */}
          <ModelChapterTabs />
          {children}
        </div>
        <FloatingStack />
      </FloatingStackProvider>
    </ChapterActionSlotProvider>
  )
}
