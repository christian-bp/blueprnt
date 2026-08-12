"use node"

import { tool } from "ai"
import { z } from "zod"
import { internal } from "../_generated/api"
import type { ActionCtx } from "../_generated/server"
import type { AssistantChartKind } from "./tables"

// Tool name -> chart kind. The generation loop consults this to append a
// chart part when one of the visual tools completes; get_org_stats and
// get_pay_stats are numbers-only and append nothing.
export const VISUAL_TOOL_CHARTS: Record<string, AssistantChartKind> = {
  show_headcount_trend: "headcountTrend",
  show_pay_gap_trend: "payGapTrend",
}

// All tools are read-only org-level aggregates (ADR-0018): execute closures
// capture the action ctx and the caller's already-authorized orgId; the
// model never chooses an org. Tool outputs are exactly the insight query
// returns (numbers + composed summary), which is what the model sees.
//
// Each description states its figures' DATA BASIS explicitly (I5 in
// insights.ts): get_org_stats and the two trend tools read the frozen
// pay-mapping population, get_pay_stats reads the live register as of now.
// The two bases can disagree and the model must never conflate them.
export function buildAssistantTools(ctx: ActionCtx, args: { orgId: string }) {
  return {
    get_org_stats: tool({
      description:
        "Current organization-level numbers: workforce size, number of roles, how many roles are evaluated, and the latest pay gap percentage. These figures come from the latest completed pay mapping's frozen population, not the live register. Use for any question about the organization's current state.",
      inputSchema: z.object({}),
      execute: async () =>
        await ctx.runQuery(internal.assistant.insights.orgStats, {
          orgId: args.orgId,
        }),
    }),
    get_pay_stats: tool({
      description:
        "Pay statistics for the organization: average and median monthly pay, org-wide or split by gender. These statistics come from the current live register as of today, not a frozen pay mapping. Use for questions like the average pay of female or male employees. A group may come back suppressed when it is too small to report without exposing an individual.",
      inputSchema: z.object({
        groupBy: z
          .enum(["gender"])
          .optional()
          .describe("Split the statistics by gender."),
      }),
      execute: async (input) =>
        await ctx.runQuery(internal.assistant.insights.payStats, {
          orgId: args.orgId,
          asOf: Date.now(),
          ...(input.groupBy !== undefined ? { groupBy: input.groupBy } : {}),
        }),
    }),
    show_headcount_trend: tool({
      description:
        "Display the headcount trend chart to the user (one point per completed pay mapping) and get its aggregate numbers. Use when the user asks how headcount has developed.",
      inputSchema: z.object({}),
      execute: async () =>
        await ctx.runQuery(internal.assistant.insights.payMappingTrend, {
          orgId: args.orgId,
          metric: "headcount",
        }),
    }),
    show_pay_gap_trend: tool({
      description:
        "Display the pay gap trend chart to the user (one point per completed pay mapping) and get its aggregate numbers. Use when the user asks how the pay gap has developed.",
      inputSchema: z.object({}),
      execute: async () =>
        await ctx.runQuery(internal.assistant.insights.payMappingTrend, {
          orgId: args.orgId,
          metric: "gap",
        }),
    }),
  }
}
