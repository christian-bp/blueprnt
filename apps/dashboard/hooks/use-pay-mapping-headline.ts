"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { PayGapFlag } from "@workspace/core"
import { useQuery } from "convex/react"
import { pickHeadlineRun } from "@/lib/pay-mapping-headline"

export type PayMappingHeadline = {
  slug: string
  label: string
  status: "active" | "paused" | "underReview" | "completed"
  gapPct: number | null
  flag: PayGapFlag
}

// Picks the run the overview's pay-mapping card should headline (the same
// rule buildOverviewStats' "open run" pick uses, falling back to the most
// recent completed run) and reads its org-level gap off the run row.
//
// One subscription, not two. The gap used to come from getPayMappingGap,
// which collects every snapshot row of the run and computes the whole
// equal-work / women-dominated / quartile pipeline, to read two numbers off
// the end of it: an org-scaled unbounded read on the page every session
// starts at. Those two numbers are frozen onto the run at freeze time for
// exactly this reason, and listPayMappingRuns (already subscribed to here,
// and shared with the trend hooks) carries them.
//
// undefined = the run list is still loading; null = no run worth headlining
// yet (a fresh org that has never mapped), in which case the card stays on
// its plain empty/blocked/ready text.
export function usePayMappingHeadline(
  orgId: string
): PayMappingHeadline | undefined | null {
  const runs = useQuery(api.payMapping.runs.listPayMappingRuns, { orgId })
  if (runs === undefined) return undefined
  const target = pickHeadlineRun(runs)
  if (target === undefined) return null

  return {
    slug: target.slug,
    label: target.label,
    status: target.status,
    gapPct: target.orgGapPct,
    flag: target.orgGapFlag,
  }
}
