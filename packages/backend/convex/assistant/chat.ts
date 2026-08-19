import type { GenericMutationCtx, GenericQueryCtx } from "convex/server"
import { v } from "convex/values"
import { internal } from "../_generated/api"
import type { DataModel, Doc, Id } from "../_generated/dataModel"
import { internalMutation, internalQuery } from "../_generated/server"
import {
  ASSISTANT_HISTORY_LIMIT,
  ASSISTANT_HOURLY_MESSAGE_CAP,
  ASSISTANT_THREAD_LIST_LIMIT,
  ASSISTANT_TITLE_MAX_LENGTH,
  MAX_ASSISTANT_MESSAGE_LENGTH,
} from "../ai/config"
import { promptLocale } from "../evaluationModel/localize"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { orgSettingsRow } from "../lib/orgSettings"
import { ERASE_BATCH } from "./erase"
import {
  type AssistantMessagePart,
  assistantActivityKind,
  assistantMessagePart,
} from "./tables"

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
  activity: v.optional(assistantActivityKind),
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

// Finds the caller's currently active thread, or null. Shared by every flow
// that inspects or archives "the" active thread: sendMessage's create-or-touch
// logic, its `fresh` archival, newConversation, and switchConversation.
async function findActiveThread(
  ctx: GenericQueryCtx<DataModel>,
  orgId: string,
  userId: string
): Promise<Doc<"assistantThreads"> | null> {
  return await ctx.db
    .query("assistantThreads")
    .withIndex("by_org_user_status", (q) =>
      q.eq("orgId", orgId).eq("userId", userId).eq("status", "active")
    )
    .unique()
}

// Whether a thread's most recent message is still streaming: archiving (or
// switching away from) a thread in this state would silently orphan the
// in-flight reply, exactly like the New-conversation hazard the client-side
// disable already guards against (app/(app)/assistant/page.tsx). Callers
// that would archive the CURRENT active thread as a SIDE EFFECT of some other
// action (a fresh send, a history switch) check this first and throw instead
// of archiving. newConversation itself is unchanged: it is the direct,
// user-initiated action the client already disables while busy.
async function isThreadStreaming(
  ctx: GenericQueryCtx<DataModel>,
  threadId: Id<"assistantThreads">
): Promise<boolean> {
  const last = await ctx.db
    .query("assistantMessages")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId))
    .order("desc")
    .first()
  return last !== null && last.status === "streaming"
}

// The archival newConversation has always done: patch the thread to
// "archived", no other side effects. Shared so a fresh send and a history
// switch archive the current thread the same way instead of re-deriving it.
async function archiveThread(
  ctx: GenericMutationCtx<DataModel>,
  threadId: Id<"assistantThreads">
): Promise<void> {
  await ctx.db.patch(threadId, { status: "archived" })
}

const threadListShape = v.object({
  _id: v.id("assistantThreads"),
  title: v.optional(v.string()),
  status: v.union(v.literal("active"), v.literal("archived")),
  lastMessageAt: v.number(),
})

export const getActiveThread = orgQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("assistantThreads"),
      lastMessageAt: v.number(),
      title: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    const thread = await findActiveThread(ctx, ctx.orgId, ctx.authUserId)
    return thread === null
      ? null
      : {
          _id: thread._id,
          lastMessageAt: thread.lastMessageAt,
          ...(thread.title !== undefined ? { title: thread.title } : {}),
        }
  },
})

// The caller's own conversation history, both statuses, most recently active
// first: an indexed, bounded read (ASSISTANT_THREAD_LIST_LIMIT), never a
// table scan. Ordered by lastMessageAt (not _creationTime): switching back
// into an old thread bumps its lastMessageAt without changing when it was
// first created, so only the dedicated index orders correctly.
export const listThreads = orgQuery({
  args: {},
  returns: v.array(threadListShape),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("assistantThreads")
      .withIndex("by_org_user_lastMessageAt", (q) =>
        q.eq("orgId", ctx.orgId).eq("userId", ctx.authUserId)
      )
      .order("desc")
      .take(ASSISTANT_THREAD_LIST_LIMIT)
    return rows.map((thread) => ({
      _id: thread._id,
      ...(thread.title !== undefined ? { title: thread.title } : {}),
      status: thread.status,
      lastMessageAt: thread.lastMessageAt,
    }))
  },
})

// Shared ownership check for both a thread and a message row: neither exists
// (or belongs to the caller) outside its own org and its own user, so a
// mismatch on either field throws the same "not a member" code a stranger's
// id would. An assertion function (rather than returning a boolean) so the
// caller's row narrows from nullable to present without a redundant check.
// Used by listMessages and switchConversation (a thread) and stopGeneration (a
// message), which share this exact shape.
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
      ...(m.activity !== undefined ? { activity: m.activity } : {}),
    }))
  },
})

export const sendMessage = orgMutation({
  args: {
    text: v.string(),
    locale: v.string(),
    fresh: v.optional(v.boolean()),
  },
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

    // A fresh send (the overview prompt) always starts a brand-new thread:
    // archive the current active one first, in this same mutation, so the
    // two never coexist. Guarded exactly like the busy check below: an
    // in-flight reply on the thread being archived would otherwise be
    // silently orphaned (the same hazard newConversation's client-side
    // disable exists for).
    if (args.fresh === true) {
      const current = await findActiveThread(ctx, ctx.orgId, ctx.authUserId)
      if (current !== null) {
        if (await isThreadStreaming(ctx, current._id)) {
          throw appError(ERROR_CODES.assistantBusy)
        }
        await archiveThread(ctx, current._id)
      }
    }

    let thread = await findActiveThread(ctx, ctx.orgId, ctx.authUserId)
    if (thread !== null) {
      if (await isThreadStreaming(ctx, thread._id)) {
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
    // onboarding completes (unlike the AI drafting/review flows, which
    // require it).
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
    const thread = await findActiveThread(ctx, ctx.orgId, ctx.authUserId)
    if (thread !== null) {
      await archiveThread(ctx, thread._id)
    }
    return null
  },
})

// User-driven rename from the history panel's row menu. Trimmed and bounded
// to the same length the AI title obeys (ASSISTANT_TITLE_MAX_LENGTH), so a
// manual rename can never exceed what the model's own title is allowed to
// produce. No busy guard: renaming a thread mid-stream touches only its
// title, never the message it is generating, so it is harmless regardless of
// whether the thread is currently active or streaming. Once this patches
// `title`, setThreadTitle's own write-once guard (it never overwrites an
// existing title) makes a later AI-generated title for this thread a no-op,
// so a rename can never be clobbered by a still-in-flight title call. No
// audit row: assistant chat is telemetry, not domain state (ADR-0018), the
// same stance deleteConversation already takes.
export const renameConversation = orgMutation({
  args: { threadId: v.id("assistantThreads"), title: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId)
    assertOwned(ctx, thread)
    const title = args.title.trim()
    if (title === "" || title.length > ASSISTANT_TITLE_MAX_LENGTH) {
      throw appError(ERROR_CODES.invalidInput)
    }
    await ctx.db.patch(args.threadId, { title })
    return null
  },
})

// Ownership-checked history navigation: switching to an already-active thread
// is a no-op (nothing to archive, nothing to touch). Otherwise archives the
// CURRENT active thread (throwing assistantBusy instead, if its last message
// is still streaming: the same orphan hazard the fresh-send guard above
// exists for) and activates the selected one, bumping its lastMessageAt so it
// sorts to the top of the next listThreads read.
export const switchConversation = orgMutation({
  args: { threadId: v.id("assistantThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.threadId)
    assertOwned(ctx, target)
    if (target.status === "active") return null

    const current = await findActiveThread(ctx, ctx.orgId, ctx.authUserId)
    if (current !== null) {
      if (await isThreadStreaming(ctx, current._id)) {
        throw appError(ERROR_CODES.assistantBusy)
      }
      await archiveThread(ctx, current._id)
    }
    await ctx.db.patch(args.threadId, {
      status: "active",
      lastMessageAt: Date.now(),
    })
    return null
  },
})

// Deletes up to ERASE_BATCH of the thread's messages (shared with
// assistant/erase.ts, so one constant governs every per-transaction
// message-deletion budget in this table). Child-first: the thread row is
// deleted only once none of its messages remain, so a page that exactly
// fills the budget defers the thread delete and reschedules a follow-up
// batch instead.
async function deleteThreadBatch(
  ctx: GenericMutationCtx<DataModel>,
  threadId: Id<"assistantThreads">
): Promise<void> {
  const messages = await ctx.db
    .query("assistantMessages")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId))
    .take(ERASE_BATCH)
  for (const message of messages) {
    await ctx.db.delete(message._id)
  }
  if (messages.length >= ERASE_BATCH) {
    await ctx.scheduler.runAfter(
      0,
      internal.assistant.chat.deleteConversationBatch,
      { threadId }
    )
    return
  }
  await ctx.db.delete(threadId)
}

// Scheduled continuation once a thread's messages outgrow one transaction.
// The public deleteConversation entry already checked ownership and the busy
// guard once; a race that erases the thread before this runs (another
// erasure path, a duplicate schedule) leaves nothing to do.
export const deleteConversationBatch = internalMutation({
  args: { threadId: v.id("assistantThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId)
    if (thread === null) return null
    await deleteThreadBatch(ctx, args.threadId)
    return null
  },
})

// Hard-deletes a conversation from the caller's own history: never an
// archive. Refuses while the thread's last message is still streaming, the
// same orphan hazard newConversation/switchConversation guard against, so an
// in-flight reply can never be deleted out from under the generation writing
// it. Deleting the active thread is allowed while idle: afterwards
// getActiveThread simply returns null and the page shows its empty state.
// No audit row: assistant chat is telemetry, not domain state (ADR-0018).
export const deleteConversation = orgMutation({
  args: { threadId: v.id("assistantThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId)
    assertOwned(ctx, thread)
    if (await isThreadStreaming(ctx, args.threadId)) {
      throw appError(ERROR_CODES.assistantBusy)
    }
    await deleteThreadBatch(ctx, args.threadId)
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
    // Omitted (undefined) clears the field: patch removes a key whose value
    // is explicitly undefined, so a flush that has no activity to report
    // (the text-delta interval flush, the tool-result flush once a tool
    // resolves) always overwrites a stale "checkingData" left by an earlier
    // flush in the same generation.
    activity: v.optional(assistantActivityKind),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId)
    // A vanished or already-finalized row means the generation must stop
    // writing (erasure, archive, or a competing finalize won).
    if (message === null || message.status !== "streaming") return true
    if (message.stopRequested === true) return true
    await ctx.db.patch(args.messageId, {
      parts: args.parts,
      activity: args.activity,
    })
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
      // Every terminal status clears the in-progress activity marker: a
      // finalized message never shows a "checking your data" shimmer.
      activity: undefined,
      ...(args.errorCode !== undefined ? { errorCode: args.errorCode } : {}),
    })
    return null
  },
})

// Called best-effort from the title-generation side call (title.ts), once per
// thread. Writes only when the thread still exists and has no title yet, so
// a slow call that resolves after a second one already won (or after the
// thread was erased) can never overwrite a title or resurrect a deleted row.
export const setThreadTitle = internalMutation({
  args: { threadId: v.id("assistantThreads"), title: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId)
    if (thread === null || thread.title !== undefined) return null
    await ctx.db.patch(args.threadId, { title: args.title })
    return null
  },
})
