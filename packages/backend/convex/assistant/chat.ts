import { v } from "convex/values"
import { internal } from "../_generated/api"
import { internalMutation, internalQuery } from "../_generated/server"
import {
  ASSISTANT_HISTORY_LIMIT,
  ASSISTANT_HOURLY_MESSAGE_CAP,
  MAX_ASSISTANT_MESSAGE_LENGTH,
} from "../ai/config"
import { promptLocale } from "../evaluationModel/localize"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { orgSettingsRow } from "../lib/orgSettings"
import { type AssistantMessagePart, assistantMessagePart } from "./tables"

const HOUR_MS = 60 * 60 * 1000
// The UI shows one bounded conversation; older messages age out of the
// window. Bounded read by design (org-scale conventions).
const MESSAGE_WINDOW = 100

const messageShape = v.object({
  _id: v.id("assistantMessages"),
  role: v.union(v.literal("user"), v.literal("assistant")),
  status: v.union(
    v.literal("complete"),
    v.literal("streaming"),
    v.literal("failed"),
    v.literal("stopped")
  ),
  parts: v.array(assistantMessagePart),
  errorCode: v.optional(v.string()),
})

// One text view of a message's parts, used both for the model's history and
// nowhere else: chart parts become a bracketed note so follow-up turns know
// what was shown and which numbers it carried.
export function contextText(parts: AssistantMessagePart[]): string {
  return parts
    .map((part) =>
      part.type === "text"
        ? part.text
        : `[Displayed the ${part.chart} chart. ${part.summary}]`
    )
    .join("\n")
}

export const getActiveThread = orgQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ _id: v.id("assistantThreads"), lastMessageAt: v.number() })
  ),
  handler: async (ctx) => {
    const thread = await ctx.db
      .query("assistantThreads")
      .withIndex("by_org_user_status", (q) =>
        q
          .eq("orgId", ctx.orgId)
          .eq("userId", ctx.authUserId)
          .eq("status", "active")
      )
      .unique()
    return thread === null
      ? null
      : { _id: thread._id, lastMessageAt: thread.lastMessageAt }
  },
})

// Shared ownership check for both a thread and a message row: neither exists
// (or belongs to the caller) outside its own org and its own user, so a
// mismatch on either field throws the same "not a member" code a stranger's
// id would. An assertion function (rather than returning a boolean) so the
// caller's row narrows from nullable to present without a redundant check.
// Used by both listMessages (a thread) and stopGeneration (a message), which
// share this exact shape.
function assertOwned<T extends { orgId: string; userId: string }>(
  ctx: { orgId: string; authUserId: string },
  row: T | null
): asserts row is T {
  if (
    row === null ||
    row.orgId !== ctx.orgId ||
    row.userId !== ctx.authUserId
  ) {
    throw appError(ERROR_CODES.notAMember)
  }
}

export const listMessages = orgQuery({
  args: { threadId: v.id("assistantThreads") },
  returns: v.array(messageShape),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId)
    assertOwned(ctx, thread)
    const recent = await ctx.db
      .query("assistantMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(MESSAGE_WINDOW)
    return recent.reverse().map((m) => ({
      _id: m._id,
      role: m.role,
      status: m.status,
      parts: m.parts,
      ...(m.errorCode !== undefined ? { errorCode: m.errorCode } : {}),
    }))
  },
})

export const sendMessage = orgMutation({
  args: { text: v.string(), locale: v.string() },
  returns: v.id("assistantThreads"),
  handler: async (ctx, args) => {
    const text = args.text.trim().slice(0, MAX_ASSISTANT_MESSAGE_LENGTH)
    if (text === "") throw appError(ERROR_CODES.assistantInvalidMessage)

    const hourAgo = Date.now() - HOUR_MS
    const recent = await ctx.db
      .query("assistantMessages")
      .withIndex("by_org_user", (q) =>
        q
          .eq("orgId", ctx.orgId)
          .eq("userId", ctx.authUserId)
          .gt("_creationTime", hourAgo)
      )
      .collect()
    if (
      recent.filter((m) => m.role === "user").length >=
      ASSISTANT_HOURLY_MESSAGE_CAP
    ) {
      throw appError(ERROR_CODES.assistantRateLimited)
    }

    let thread = await ctx.db
      .query("assistantThreads")
      .withIndex("by_org_user_status", (q) =>
        q
          .eq("orgId", ctx.orgId)
          .eq("userId", ctx.authUserId)
          .eq("status", "active")
      )
      .unique()
    if (thread !== null) {
      const activeThreadId = thread._id
      const last = await ctx.db
        .query("assistantMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", activeThreadId))
        .order("desc")
        .first()
      if (last !== null && last.status === "streaming") {
        throw appError(ERROR_CODES.assistantBusy)
      }
      await ctx.db.patch(thread._id, { lastMessageAt: Date.now() })
    } else {
      const threadId = await ctx.db.insert("assistantThreads", {
        orgId: ctx.orgId,
        userId: ctx.authUserId,
        status: "active",
        lastMessageAt: Date.now(),
      })
      thread = await ctx.db.get(threadId)
      if (thread === null) throw appError(ERROR_CODES.assistantBusy)
    }

    await ctx.db.insert("assistantMessages", {
      orgId: ctx.orgId,
      userId: ctx.authUserId,
      threadId: thread._id,
      role: "user",
      status: "complete",
      parts: [{ type: "text", text }],
    })
    const assistantMessageId = await ctx.db.insert("assistantMessages", {
      orgId: ctx.orgId,
      userId: ctx.authUserId,
      threadId: thread._id,
      role: "assistant",
      status: "streaming",
      parts: [],
    })

    // Company context is optional here: the assistant guides even before
    // onboarding completes (unlike the model-draft flows, which require it).
    const settings = await orgSettingsRow(ctx, ctx.orgId)
    await ctx.scheduler.runAfter(
      0,
      internal.assistant.generate.generateAssistantReply,
      {
        assistantMessageId,
        threadId: thread._id,
        orgId: ctx.orgId,
        userId: ctx.authUserId,
        locale: promptLocale(args.locale, settings?.language ?? "en"),
        ...(settings?.industry !== undefined
          ? { industry: settings.industry }
          : {}),
        ...(settings?.country !== undefined
          ? { country: settings.country }
          : {}),
        ...(settings?.employeeCount !== undefined
          ? { employeeCount: settings.employeeCount }
          : {}),
      }
    )
    return thread._id
  },
})

export const stopGeneration = orgMutation({
  args: { messageId: v.id("assistantMessages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId)
    assertOwned(ctx, message)
    if (message.status === "streaming") {
      await ctx.db.patch(args.messageId, { stopRequested: true })
    }
    return null
  },
})

export const newConversation = orgMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const thread = await ctx.db
      .query("assistantThreads")
      .withIndex("by_org_user_status", (q) =>
        q
          .eq("orgId", ctx.orgId)
          .eq("userId", ctx.authUserId)
          .eq("status", "active")
      )
      .unique()
    if (thread !== null) {
      await ctx.db.patch(thread._id, { status: "archived" })
    }
    return null
  },
})

export const getGenerationContext = internalQuery({
  args: { threadId: v.id("assistantThreads") },
  returns: v.array(
    v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      text: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const recent = await ctx.db
      .query("assistantMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(ASSISTANT_HISTORY_LIMIT)
    const ascending = recent.reverse()

    // ADR-0018's personal-data screen flags a USER message only after it is
    // already stored (sendMessage writes it eagerly, before generation
    // runs), so the flagged row itself is never empty and never "failed": it
    // is the ASSISTANT reply right after it that gets status "failed" /
    // errorCode assistantPersonalData. That reply is dropped below by the
    // existing failed-row filter, but the user row that triggered it is not,
    // so it would otherwise ride into every later prompt for as long as it
    // stays inside the history window. Find each such reply and drop the
    // user row immediately before it too, so a flagged turn is invisible to
    // the model on every subsequent generation, not just its own.
    const flaggedUserIndexes = new Set<number>()
    ascending.forEach((message, index) => {
      if (
        message.role === "assistant" &&
        message.errorCode === ERROR_CODES.assistantPersonalData
      ) {
        const prior = ascending[index - 1]
        if (prior !== undefined && prior.role === "user") {
          flaggedUserIndexes.add(index - 1)
        }
      }
    })

    return (
      ascending
        // The in-flight placeholder (empty parts) and failed rows carry no
        // signal; stopped rows keep their partial parts and stay in context.
        .filter(
          (m, index) =>
            m.parts.length > 0 &&
            m.status !== "failed" &&
            !flaggedUserIndexes.has(index)
        )
        .map((m) => ({ role: m.role, text: contextText(m.parts) }))
    )
  },
})

export const updateParts = internalMutation({
  args: {
    messageId: v.id("assistantMessages"),
    parts: v.array(assistantMessagePart),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId)
    // A vanished or already-finalized row means the generation must stop
    // writing (erasure, archive, or a competing finalize won).
    if (message === null || message.status !== "streaming") return true
    if (message.stopRequested === true) return true
    await ctx.db.patch(args.messageId, { parts: args.parts })
    return false
  },
})

export const finalizeReply = internalMutation({
  args: {
    messageId: v.id("assistantMessages"),
    status: v.union(
      v.literal("complete"),
      v.literal("failed"),
      v.literal("stopped")
    ),
    parts: v.array(assistantMessagePart),
    errorCode: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId)
    if (message === null || message.status !== "streaming") return null
    await ctx.db.patch(args.messageId, {
      status: args.status,
      parts: args.parts,
      ...(args.errorCode !== undefined ? { errorCode: args.errorCode } : {}),
    })
    return null
  },
})
