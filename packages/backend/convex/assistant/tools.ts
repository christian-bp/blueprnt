"use node"

import { tool } from "ai"
import { z } from "zod"
import { internal } from "../_generated/api"
import type { ActionCtx } from "../_generated/server"
import type { AssistantChartKind } from "./tables"

// All tools are read-only org-level aggregates (ADR-0018): execute closures
// capture the action ctx and the caller's already-authorized orgId; the
// model never chooses an org. Tool outputs are exactly the insight query
// returns (numbers + composed summary), which is what the model sees.
//
// Each description states its figures' DATA BASIS explicitly (see
// insights.ts). get_org_stats is SPLIT: workforce size and the pay gap come
// from the latest completed pay mapping's frozen data (same as the two trend
// tools, one point per pay mapping each), while its role counts come from
// the live roles register, because that count changes as roles are added or
// evaluated between pay mappings. get_pay_stats reads the live register as
// of now. The bases can disagree and the model must never conflate them.
export function buildAssistantTools(ctx: ActionCtx, args: { orgId: string }) {
  return {
    get_org_stats: tool({
      description:
        "Current organization-level numbers: workforce size, number of roles, how many roles are evaluated, and the latest pay gap percentage. Workforce size and the pay gap come from the latest completed pay mapping's frozen data; the role counts come from the live roles register, not the pay mapping. Use for any question about the organization's current state.",
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

type AssistantToolName = keyof ReturnType<typeof buildAssistantTools>

// Tool name -> chart kind. Keyed off AssistantToolName (derived from
// buildAssistantTools's own return type) via `satisfies`, so a typo in
// either this map's key or a tool's name above is a compile error (an
// excess/unknown property), never a silently-dropped chart. get_org_stats
// and get_pay_stats are numbers-only and are intentionally absent.
//
// Kept module-private (not exported) and referenced from exactly one
// exported declaration below: TS's declaration-emit checker (this project
// builds with `declaration: true`) hits a pathological, whole-program
// instantiation blowup when a type this deep, derived from the "ai"
// package's generic `tool()` schemas, is echoed into more than one exported
// signature. chartForTool's own signature below uses only plain `string` and
// `AssistantChartKind | null`, so it never re-prints this type.
const VISUAL_TOOL_CHARTS = {
  show_headcount_trend: "headcountTrend",
  show_pay_gap_trend: "payGapTrend",
} satisfies Partial<Record<AssistantToolName, AssistantChartKind>>

// The generation loop's only entry point into the map above: a plain
// `string` in, `AssistantChartKind | null` out, so generate.ts never needs
// to narrow part.toolName (widened to `string` by the SDK's tool-result
// union) or cast anything itself. The cast here is internal and sound: the
// `in` check on the line above it is exactly what it asserts.
export function chartForTool(name: string): AssistantChartKind | null {
  return name in VISUAL_TOOL_CHARTS
    ? VISUAL_TOOL_CHARTS[name as keyof typeof VISUAL_TOOL_CHARTS]
    : null
}
