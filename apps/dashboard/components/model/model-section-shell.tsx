"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { ModelChapterTabs } from "@/components/model/model-chapter-tabs"
import { ModelSpine } from "@/components/model/model-spine"
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
// everything the derivation needs (the twelve checks, the approval, the
// working-conditions decision), so the section's standing readout costs one
// subscription rather than one per chapter.
export function ModelSectionShell({ children }: { children: ReactNode }) {
  const { orgId } = useOrganization()
  const t = useTranslations("dashboard.model.chapters")
  const pathname = usePathname()
  const data = useQuery(api.evaluationModel.approval.getMethodChecks, { orgId })
  const active = currentChapter(pathname)

  // No model yet reads as nothing decided, not as no bar: an org that has not
  // started still has the same four chapters ahead of it, and the empty bar is
  // what says so.
  const input: ModelProgressInput =
    data === undefined || data === null
      ? { checks: [], approved: false, workingConditionsDecided: false }
      : {
          checks: data.checks,
          approved: data.approval !== null,
          workingConditionsDecided: data.workingConditions !== null,
        }
  const overall = modelProgress(input)

  return (
    <div className="space-y-4">
      {data === undefined ? (
        // Content-shaped: the spine's real heading (static i18n text, so it
        // renders real) over a flat track standing in for the segmented bar,
        // plus the reserved line the open chapter's count lands on, so nothing
        // reflows on arrival. No skeleton bar beside the heading: the heading
        // carries no visible figure to stand in for.
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">{t("heading")}</h3>
          </div>
          <div className="space-y-1">
            <div className="h-2 w-full rounded-full bg-primary/12" />
            <div className="h-4" />
          </div>
        </section>
      ) : (
        <ModelSpine
          done={overall.done}
          total={overall.total}
          chapters={MODEL_CHAPTERS.map((chapter) => ({
            key: chapter,
            ...modelChapterProgress(input, chapter),
          }))}
          activeChapter={active}
        />
      )}
      <ModelChapterTabs />
      {children}
    </div>
  )
}
