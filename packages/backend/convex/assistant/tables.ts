import { defineTable } from "convex/server"
import type { Infer } from "convex/values"
import { v } from "convex/values"

// One conversation per HR user per org at a time (status "active"); starting a
// new conversation archives the old one rather than deleting it, so history
// survives until erasure. Chat content is user-typed and may incidentally
// contain personal data despite the UI guidance, so both tables carry userId
// and are hard-deleted by the user-erasure path (ADR-0018); by_user exists
// for that cross-org erasure walk.
export const assistantThreads = defineTable({
  orgId: v.string(),
  userId: v.string(),
  status: v.union(v.literal("active"), v.literal("archived")),
  lastMessageAt: v.number(),
})
  .index("by_org_user_status", ["orgId", "userId", "status"])
  .index("by_user", ["userId"])

// The chart kinds the assistant can display. A chart part stores ONLY the
// kind: the client renders from live org data through the same components the
// overview uses, so no data series is ever duplicated into chat storage.
export const assistantChartKind = v.union(
  v.literal("headcountTrend"),
  v.literal("payGapTrend")
)
export type AssistantChartKind = Infer<typeof assistantChartKind>

// summary is the aggregate text the MODEL received from the tool, kept so the
// conversation history can be rebuilt for follow-up turns. It contains only
// org-level numbers by construction (see assistant/insights.ts validators).
export const assistantMessagePart = v.union(
  v.object({ type: v.literal("text"), text: v.string() }),
  v.object({
    type: v.literal("chart"),
    chart: assistantChartKind,
    summary: v.string(),
  })
)
export type AssistantMessagePart = Infer<typeof assistantMessagePart>

// The assistant's in-progress work signal while a reply is streaming: a
// transient hint the UI renders as a "checking your data" shimmer below the
// parts already shown. A literal union of one so a future second signal is a
// type-checked addition, never a magic string; cleared (unset, not just
// overwritten) once the triggering tool resolves or the reply finalizes, so
// it never lingers as stale history.
export const assistantActivityKind = v.union(v.literal("checkingData"))
export type AssistantActivityKind = Infer<typeof assistantActivityKind>

// parts on an assistant row grow while status is "streaming" (the generation
// action flushes its accumulated parts); "stopped" keeps the partial parts.
// stopRequested is the cooperative abort flag the action reads at each flush.
// activity is transient UI state, not conversation content: it is never read
// by getGenerationContext and carries no history value once cleared.
// No audit rows and no person fields, ever (ADR-0018): conversational
// telemetry only. by_org_user backs the per-user hourly send cap.
export const assistantMessages = defineTable({
  orgId: v.string(),
  userId: v.string(),
  threadId: v.id("assistantThreads"),
  role: v.union(v.literal("user"), v.literal("assistant")),
  status: v.union(
    v.literal("complete"),
    v.literal("streaming"),
    v.literal("failed"),
    v.literal("stopped")
  ),
  parts: v.array(assistantMessagePart),
  errorCode: v.optional(v.string()),
  stopRequested: v.optional(v.boolean()),
  activity: v.optional(assistantActivityKind),
})
  .index("by_thread", ["threadId"])
  .index("by_org_user", ["orgId", "userId"])
