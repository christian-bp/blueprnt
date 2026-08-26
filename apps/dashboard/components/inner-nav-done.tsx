"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { NavDoneMark } from "@/components/nav-done-mark"
import { useOrganization } from "@/components/org-context"
import type { InnerNavDoneId } from "@/lib/navigation"
import {
  type ModelChapter,
  modelChapterProgress,
  type ModelProgressInput,
} from "@/lib/model-chapters"

// Which model chapter each registry id means. A total Record, so a new id
// cannot compile without its chapter.
const DONE_CHAPTER: Record<InnerNavDoneId, ModelChapter> = {
  modelCriteria: "criteria",
  modelWeighting: "weighting",
  modelMethod: "method",
  modelApproval: "approval",
}

// The inner-nav rows' done-mark: the registry names a mark by id
// (lib/navigation.ts InnerNavDoneId) and this component owns what each id
// means, the InnerNavCount contract. All four ids read the same
// getMethodChecks subscription the model section's own spine reads (deduped
// by the client), and derive through the same modelChapterProgress, so a row's
// tick and the instrument's segment can never disagree about a chapter.
// While the checks load, nothing renders: a tick springing in with the truth
// beats one flashing off a placeholder.
export function InnerNavDone({ id }: { id: InnerNavDoneId }) {
  const t = useTranslations("dashboard.nav")
  const { orgId } = useOrganization()
  const data = useQuery(api.evaluationModel.approval.getMethodChecks, { orgId })
  if (data === undefined || data === null) return null
  const input: ModelProgressInput = {
    checks: data.checks,
    approved: data.approval !== null,
    weightsSaved: data.weightsSaved,
  }
  const progress = modelChapterProgress(input, DONE_CHAPTER[id])
  if (progress.total === 0 || progress.done !== progress.total) return null
  return <NavDoneMark label={t("chapterDoneLabel")} />
}
