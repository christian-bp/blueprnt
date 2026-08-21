"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import NumberFlow from "@number-flow/react"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { ChapterActionSlotProvider } from "@/components/chapter-action-slot"
import { ModelChapterTabs } from "@/components/model/model-chapter-tabs"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SectionTitleRow } from "@/components/section-title-row"
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
  const tHelp = useTranslations("dashboard.help")
  const pathname = usePathname()
  const data = useQuery(api.evaluationModel.approval.getMethodChecks, { orgId })
  const active = currentChapter(pathname)

  // No model yet reads as nothing decided, not as no bar: an org that has not
  // started still has the same four chapters ahead of it, and the empty bar is
  // what says so.
  const input: ModelProgressInput =
    data === undefined || data === null
      ? { checks: [], approved: false }
      : { checks: data.checks, approved: data.approval !== null }
  const overall = modelProgress(input)
  // Each chapter's own done/total, in chapter order, for the instrument's
  // segments and the count under the open one.
  const chapters = MODEL_CHAPTERS.map((chapter) => ({
    key: chapter,
    ...modelChapterProgress(input, chapter),
  }))

  return (
    // The chapter's own action renders inside the chapter, where its data is,
    // and lands in the tab row above it (ChapterActionSlot).
    <ChapterActionSlotProvider>
      <div className="space-y-4">
        {/* The section's title, its one explainer, and where the whole model
            stands, opposite it. */}
        <SectionTitleRow
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
              done={overall.done}
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
        {/* The journey row: the tabs and this chapter's action. The open
            chapter's figures sit under the instrument above. */}
        <ModelChapterTabs />
        {children}
      </div>
    </ChapterActionSlotProvider>
  )
}
