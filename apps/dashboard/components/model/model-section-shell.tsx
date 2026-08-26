"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import NumberFlow from "@number-flow/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import {
  ChapterActionSlot,
  ChapterActionSlotProvider,
} from "@/components/chapter-action-slot"
import {
  FloatingStack,
  FloatingStackProvider,
} from "@/components/floating-stack"
import { HelpMorphButton } from "@/components/help-morph-button"
import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"
import { SegmentedProgress } from "@/components/segmented-progress"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"
import {
  chapterHref,
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
  const tNav = useTranslations("dashboard.nav")
  const tHelp = useTranslations("dashboard.help")
  const pathname = usePathname()
  const data = useQuery(api.evaluationModel.approval.getMethodChecks, { orgId })
  const active = currentChapter(pathname)
  usePageTitle(active === undefined ? tNav("model") : t(active))

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
  // The journey's continuation: once the OPEN chapter's own work is done, the
  // page ends by naming the next chapter, so finishing a station never leaves
  // the reader to work out from the tabs where the build goes on. Only on a
  // finished chapter (an unfinished one instructs through its own work), only
  // while a next exists (Godkännande is the journey's end), and only once the
  // progress input is real, so a still-loading chapter never flashes it.
  const activeIndex = active === undefined ? -1 : MODEL_CHAPTERS.indexOf(active)
  const activeProgress = activeIndex === -1 ? undefined : chapters[activeIndex]
  const nextChapter =
    activeIndex === -1 ? undefined : MODEL_CHAPTERS[activeIndex + 1]
  const showContinuation =
    data !== undefined &&
    activeProgress !== undefined &&
    activeProgress.total > 0 &&
    activeProgress.done === activeProgress.total &&
    nextChapter !== undefined

  return (
    // Two slots the chapter fills from its own tree: its action, which lands
    // on the journey row, and its pills, which land in the floating stack.
    <ChapterActionSlotProvider>
      <FloatingStackProvider>
        <div className="space-y-4">
          {/* THE TRAIL IS THE TITLE, as on every other page. The chapters
              are sidebar rows now, so each chapter page's trail ends at the
              chapter itself, the way People's rows do; the area crumb links
              at the first chapter directly rather than at /model, whose only
              content is the redirect there.
              The help rides after the last crumb and the instrument takes the
              row's right side, which is where the kartläggning's analysis
              journey already puts its own. */}
          <PageBreadcrumbRow
            segments={
              active === undefined
                ? [{ label: tNav("model") }]
                : [
                    {
                      label: tNav("model"),
                      href: chapterHref(MODEL_CHAPTERS[0]),
                    },
                    { label: t(active) },
                  ]
            }
            adornment={
              <HelpMorphButton label={tHelp("modelProgressLabel")}>
                {tHelp("modelProgressBody")}
              </HelpMorphButton>
            }
            actions={
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
          {children}
          {/* The chapter's closing row: its own actions (portalled up from
              the chapter's tree) beside the journey's continuation. One row
              at the foot rather than a band at the top, so the acts sit
              where the reader is when the chapter's work ends. It removes
              itself when the slot is empty AND no continuation is offered,
              so a chapter with neither carries no strip of held air. */}
          <div className="flex items-center justify-end gap-2 [&:has(>[data-slot=chapter-action]:empty):not(:has(>a))]:hidden">
            <ChapterActionSlot />
            {showContinuation && nextChapter !== undefined && (
              <Link
                href={chapterHref(nextChapter)}
                className={cn(buttonVariants())}
              >
                {t("nextCta", { chapter: t(nextChapter) })}
              </Link>
            )}
          </div>
        </div>
        <FloatingStack />
      </FloatingStackProvider>
    </ChapterActionSlotProvider>
  )
}
