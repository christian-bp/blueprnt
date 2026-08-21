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
// everything the derivation needs (the twelve checks, the materiality one
// among them, and the approval), so the section's standing readout costs one
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
      ? { checks: [], approved: false }
      : { checks: data.checks, approved: data.approval !== null }
  const overall = modelProgress(input)
  // Derived ONCE and handed to both the instrument and the tab row, so a
  // chapter's segment and its tab can never disagree about the chapter they
  // both describe.
  const chapters = MODEL_CHAPTERS.map((chapter) => ({
    key: chapter,
    ...modelChapterProgress(input, chapter),
  }))
  const loading = data === undefined

  return (
    <div className="space-y-4">
      {loading ? (
        // Content-shaped: the spine's real title (static i18n text, so it
        // renders real) with a flat track standing in for the instrument
        // opposite it, at the instrument's own width, so nothing moves when
        // the data lands. No counter beside it: the figures are exactly what
        // is still loading.
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h3 className="font-semibold text-base">{t("heading")}</h3>
          <div className="h-2 w-64 shrink-0 rounded-full bg-primary/12" />
        </div>
      ) : (
        <ModelSpine
          done={overall.done}
          total={overall.total}
          chapters={chapters}
          activeChapter={active}
        />
      )}
      {/* The tab row prints the OPEN chapter's own figures, from the same
          array the instrument above draws. Withheld while the query is in
          flight, so a tab never shows a zero it is about to replace. */}
      <ModelChapterTabs chapters={loading ? undefined : chapters} />
      {children}
    </div>
  )
}
