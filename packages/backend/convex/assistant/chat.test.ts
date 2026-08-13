import { describe, expect, it, vi } from "vitest"
import { api, components, internal } from "../_generated/api"
import {
  ASSISTANT_THREAD_LIST_LIMIT,
  ASSISTANT_TITLE_MAX_LENGTH,
} from "../ai/config"
import { ERROR_CODES } from "../lib/errors"
import { initConvexTest } from "../testing.helpers"
import { ERASE_BATCH } from "./erase"

// Seeds one org with a single member, mirroring the canonical
// seedTemplateOrganization pattern (assessment/roles.test.ts): seedMembership
// creates the org and its first member row, and t.withIdentity(subject)
// authenticates as that member for org-scoped calls.
async function seedOrgWithMember(
  t: ReturnType<typeof initConvexTest>,
  email = "member@acme.se"
) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email, name: "Member Person", role: "admin" }
  )
  const asMember = t.withIdentity({ subject: userId })
  return { orgId, userId, asMember }
}

// Seeds one org with two DISTINCT members, mirroring accounts/audit.test.ts's
// setup: a second seedMembership call mints a second real user (its own
// throwaway org is never used), then seedDuplicateMember attaches that user
// to the FIRST org as a second member row.
async function seedOrgWithTwoMembers(t: ReturnType<typeof initConvexTest>) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "member@acme.se", name: "Member Person", role: "admin" }
  )
  const { userId: otherUserId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "other@acme.se", name: "Other Person", role: "admin" }
  )
  await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
    orgId,
    userId: otherUserId,
    role: "admin",
  })
  const asMember = t.withIdentity({ subject: userId })
  const asOtherMember = t.withIdentity({ subject: otherUserId })
  return { orgId, userId, otherUserId, asMember, asOtherMember }
}

describe("assistant chat", () => {
  it("sendMessage creates a thread, a user message, and a streaming placeholder", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "What is a criterion?",
      locale: "en",
    })
    const messages = await asMember.query(api.assistant.chat.listMessages, {
      orgId,
      threadId,
    })
    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({
      role: "user",
      status: "complete",
      parts: [{ type: "text", text: "What is a criterion?" }],
    })
    expect(messages[1]).toMatchObject({
      role: "assistant",
      status: "streaming",
      parts: [],
    })
  })

  it("rejects a second send while a generation is in flight", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "first",
      locale: "en",
    })
    await expect(
      asMember.mutation(api.assistant.chat.sendMessage, {
        orgId,
        text: "second",
        locale: "en",
      })
    ).rejects.toThrow(/assistantBusy/)
  })

  it("denies reading another user's thread", async () => {
    const t = initConvexTest()
    const { orgId, asMember, asOtherMember } = await seedOrgWithTwoMembers(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "mine",
      locale: "en",
    })
    await expect(
      asOtherMember.query(api.assistant.chat.listMessages, {
        orgId,
        threadId,
      })
    ).rejects.toThrow()
  })

  it("updateParts reports a requested stop and stops patching", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "hello",
      locale: "en",
    })
    const messages = await asMember.query(api.assistant.chat.listMessages, {
      orgId,
      threadId,
    })
    const placeholderId = messages[1]?._id
    if (placeholderId === undefined) throw new Error("seed")
    let stop = await t.mutation(internal.assistant.chat.updateParts, {
      messageId: placeholderId,
      parts: [{ type: "text", text: "partial" }],
    })
    expect(stop).toBe(false)
    await asMember.mutation(api.assistant.chat.stopGeneration, {
      orgId,
      messageId: placeholderId,
    })
    stop = await t.mutation(internal.assistant.chat.updateParts, {
      messageId: placeholderId,
      parts: [{ type: "text", text: "partial more" }],
    })
    expect(stop).toBe(true)
  })

  it("updateParts sets and clears the activity marker", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "how has the gap developed",
      locale: "en",
    })
    const messages = await asMember.query(api.assistant.chat.listMessages, {
      orgId,
      threadId,
    })
    const placeholderId = messages[1]?._id
    if (placeholderId === undefined) throw new Error("seed")

    await t.mutation(internal.assistant.chat.updateParts, {
      messageId: placeholderId,
      parts: [],
      activity: "checkingData",
    })
    let updated = await asMember.query(api.assistant.chat.listMessages, {
      orgId,
      threadId,
    })
    expect(updated[1]?.activity).toBe("checkingData")

    // Omitting the arg clears it (patch removes a key set to undefined):
    // the next flush after a tool resolves carries no activity.
    await t.mutation(internal.assistant.chat.updateParts, {
      messageId: placeholderId,
      parts: [{ type: "text", text: "partial" }],
    })
    updated = await asMember.query(api.assistant.chat.listMessages, {
      orgId,
      threadId,
    })
    expect(updated[1]?.activity).toBeUndefined()
  })

  it("finalizeReply clears a leftover activity marker", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "how has the gap developed",
      locale: "en",
    })
    const messages = await asMember.query(api.assistant.chat.listMessages, {
      orgId,
      threadId,
    })
    const placeholderId = messages[1]?._id
    if (placeholderId === undefined) throw new Error("seed")

    await t.mutation(internal.assistant.chat.updateParts, {
      messageId: placeholderId,
      parts: [],
      activity: "checkingData",
    })
    await t.mutation(internal.assistant.chat.finalizeReply, {
      messageId: placeholderId,
      status: "complete",
      parts: [{ type: "text", text: "The gap improved." }],
    })
    const finalized = await asMember.query(api.assistant.chat.listMessages, {
      orgId,
      threadId,
    })
    expect(finalized[1]?.activity).toBeUndefined()
  })

  it("getGenerationContext folds chart parts into text and skips empty rows", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "show the gap",
      locale: "en",
    })
    const messages = await asMember.query(api.assistant.chat.listMessages, {
      orgId,
      threadId,
    })
    const assistantMessageId = messages[1]?._id
    if (assistantMessageId === undefined) throw new Error("seed")
    await t.mutation(internal.assistant.chat.finalizeReply, {
      messageId: assistantMessageId,
      status: "complete",
      parts: [
        { type: "chart", chart: "payGapTrend", summary: "Gap 6.1% -> 4.2%." },
        { type: "text", text: "The gap is improving." },
      ],
    })
    const context = await t.query(
      internal.assistant.chat.getGenerationContext,
      {
        threadId,
      }
    )
    expect(context).toHaveLength(2)
    expect(context[1]?.role).toBe("assistant")
    expect(context[1]?.text).toContain("payGapTrend")
    expect(context[1]?.text).toContain("The gap is improving.")
  })

  it("getGenerationContext is unaffected by a streaming row's activity marker", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "how has the gap developed",
      locale: "en",
    })
    const messages = await asMember.query(api.assistant.chat.listMessages, {
      orgId,
      threadId,
    })
    const placeholderId = messages[1]?._id
    if (placeholderId === undefined) throw new Error("seed")

    // A "checkingData" activity on the still-streaming row is transient UI
    // state, not conversation content: it must not appear in the model's
    // history text, and getGenerationContext's empty-parts filter still
    // drops the row while it carries no parts yet.
    await t.mutation(internal.assistant.chat.updateParts, {
      messageId: placeholderId,
      parts: [],
      activity: "checkingData",
    })
    const context = await t.query(
      internal.assistant.chat.getGenerationContext,
      { threadId }
    )
    expect(context).toHaveLength(1)
    expect(context[0]?.role).toBe("user")
    expect(context.some((m) => m.text.includes("checkingData"))).toBe(false)
  })

  it("getGenerationContext hides a personal-data-flagged turn from later prompts", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "What is Anna Andersson's pay?",
      locale: "en",
    })
    const flaggedMessages = await asMember.query(
      api.assistant.chat.listMessages,
      { orgId, threadId }
    )
    const flaggedAssistantId = flaggedMessages[1]?._id
    if (flaggedAssistantId === undefined) throw new Error("seed")
    await t.mutation(internal.assistant.chat.finalizeReply, {
      messageId: flaggedAssistantId,
      status: "failed",
      parts: [],
      errorCode: ERROR_CODES.assistantPersonalData,
    })

    await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "What is a criterion?",
      locale: "en",
    })
    const cleanMessages = await asMember.query(
      api.assistant.chat.listMessages,
      { orgId, threadId }
    )
    const cleanAssistantId = cleanMessages[3]?._id
    if (cleanAssistantId === undefined) throw new Error("seed")
    await t.mutation(internal.assistant.chat.finalizeReply, {
      messageId: cleanAssistantId,
      status: "complete",
      parts: [
        {
          type: "text",
          text: "A criterion is a dimension roles are evaluated on.",
        },
      ],
    })

    const context = await t.query(
      internal.assistant.chat.getGenerationContext,
      { threadId }
    )
    expect(context.some((m) => m.text.includes("Anna Andersson"))).toBe(false)
    expect(context).toHaveLength(2)
    expect(context[0]).toMatchObject({
      role: "user",
      text: "What is a criterion?",
    })
    expect(context[1]?.role).toBe("assistant")
    expect(context[1]?.text).toContain("A criterion is a dimension")
  })

  it("enforces the hourly cap", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    for (let i = 0; i < 30; i += 1) {
      const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
        orgId,
        text: `message ${i}`,
        locale: "en",
      })
      const messages = await asMember.query(api.assistant.chat.listMessages, {
        orgId,
        threadId,
      })
      const lastId = messages[messages.length - 1]?._id
      if (lastId === undefined) throw new Error("seed")
      await t.mutation(internal.assistant.chat.finalizeReply, {
        messageId: lastId,
        status: "complete",
        parts: [{ type: "text", text: "ok" }],
      })
    }
    await expect(
      asMember.mutation(api.assistant.chat.sendMessage, {
        orgId,
        text: "over",
        locale: "en",
      })
    ).rejects.toThrow(/assistantRateLimited/)
  })

  it("newConversation archives the active thread", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "hello",
      locale: "en",
    })
    await asMember.mutation(api.assistant.chat.newConversation, { orgId })
    expect(
      await asMember.query(api.assistant.chat.getActiveThread, { orgId })
    ).toBeNull()
  })

  it("renameConversation denies renaming another user's thread", async () => {
    const t = initConvexTest()
    const { orgId, asMember, asOtherMember } = await seedOrgWithTwoMembers(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "mine",
      locale: "en",
    })
    await expect(
      asOtherMember.mutation(api.assistant.chat.renameConversation, {
        orgId,
        threadId,
        title: "Not yours",
      })
    ).rejects.toThrow()
  })

  it("renameConversation trims the title and rejects an empty one", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "hello",
      locale: "en",
    })

    await asMember.mutation(api.assistant.chat.renameConversation, {
      orgId,
      threadId,
      title: "  Pay gap overview  ",
    })
    expect(
      (await asMember.query(api.assistant.chat.getActiveThread, { orgId }))
        ?.title
    ).toBe("Pay gap overview")

    await expect(
      asMember.mutation(api.assistant.chat.renameConversation, {
        orgId,
        threadId,
        title: "   ",
      })
    ).rejects.toThrow(/invalidInput/)
  })

  it("renameConversation rejects a title over ASSISTANT_TITLE_MAX_LENGTH", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "hello",
      locale: "en",
    })

    await expect(
      asMember.mutation(api.assistant.chat.renameConversation, {
        orgId,
        threadId,
        title: "x".repeat(ASSISTANT_TITLE_MAX_LENGTH + 1),
      })
    ).rejects.toThrow(/invalidInput/)

    // Exactly at the bound is accepted.
    const atBound = "x".repeat(ASSISTANT_TITLE_MAX_LENGTH)
    await asMember.mutation(api.assistant.chat.renameConversation, {
      orgId,
      threadId,
      title: atBound,
    })
    expect(
      (await asMember.query(api.assistant.chat.getActiveThread, { orgId }))
        ?.title
    ).toBe(atBound)
  })

  it("renameConversation persists and listThreads reflects it", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "hello",
      locale: "en",
    })

    await asMember.mutation(api.assistant.chat.renameConversation, {
      orgId,
      threadId,
      title: "Renamed by hand",
    })

    const threads = await asMember.query(api.assistant.chat.listThreads, {
      orgId,
    })
    expect(threads.find((thread) => thread._id === threadId)?.title).toBe(
      "Renamed by hand"
    )
  })

  it("a rename makes a later AI setThreadTitle call a no-op (write-once interplay)", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "hello",
      locale: "en",
    })

    await asMember.mutation(api.assistant.chat.renameConversation, {
      orgId,
      threadId,
      title: "My own name",
    })
    // The AI title side call fires after the user already renamed the
    // thread: setThreadTitle only ever writes when the thread has no title
    // yet, so the manual rename must survive it untouched.
    await t.mutation(internal.assistant.chat.setThreadTitle, {
      threadId,
      title: "AI generated title",
    })

    expect(
      (await asMember.query(api.assistant.chat.getActiveThread, { orgId }))
        ?.title
    ).toBe("My own name")
  })

  it("sendMessage with fresh archives the active thread and starts a new one", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const firstThreadId = await asMember.mutation(
      api.assistant.chat.sendMessage,
      { orgId, text: "first", locale: "en" }
    )
    const firstMessages = await asMember.query(
      api.assistant.chat.listMessages,
      {
        orgId,
        threadId: firstThreadId,
      }
    )
    const firstAssistantId = firstMessages[1]?._id
    if (firstAssistantId === undefined) throw new Error("seed")
    await t.mutation(internal.assistant.chat.finalizeReply, {
      messageId: firstAssistantId,
      status: "complete",
      parts: [{ type: "text", text: "ok" }],
    })

    const secondThreadId = await asMember.mutation(
      api.assistant.chat.sendMessage,
      { orgId, text: "second", locale: "en", fresh: true }
    )

    expect(secondThreadId).not.toBe(firstThreadId)
    const active = await asMember.query(api.assistant.chat.getActiveThread, {
      orgId,
    })
    expect(active?._id).toBe(secondThreadId)
    const threads = await asMember.query(api.assistant.chat.listThreads, {
      orgId,
    })
    expect(threads.find((thread) => thread._id === firstThreadId)?.status).toBe(
      "archived"
    )
  })

  it("sendMessage with fresh throws assistantBusy instead of orphaning a streaming reply", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "first",
      locale: "en",
    })
    // The placeholder assistant reply is never finalized here, so it is still
    // "streaming"; a fresh send must refuse to archive it rather than
    // silently orphan the in-flight reply.
    await expect(
      asMember.mutation(api.assistant.chat.sendMessage, {
        orgId,
        text: "second",
        locale: "en",
        fresh: true,
      })
    ).rejects.toThrow(/assistantBusy/)
  })

  it("listThreads returns only the caller's own threads, most recently active first", async () => {
    const t = initConvexTest()
    const { orgId, userId, otherUserId } = await seedOrgWithTwoMembers(t)
    const older = await t.run((ctx) =>
      ctx.db.insert("assistantThreads", {
        orgId,
        userId,
        status: "archived",
        lastMessageAt: 1_000,
        title: "Older conversation",
      })
    )
    const newer = await t.run((ctx) =>
      ctx.db.insert("assistantThreads", {
        orgId,
        userId,
        status: "active",
        lastMessageAt: 2_000,
      })
    )
    await t.run((ctx) =>
      ctx.db.insert("assistantThreads", {
        orgId,
        userId: otherUserId,
        status: "active",
        lastMessageAt: 3_000,
      })
    )

    const asMember = t.withIdentity({ subject: userId })
    const threads = await asMember.query(api.assistant.chat.listThreads, {
      orgId,
    })
    expect(threads.map((thread) => thread._id)).toEqual([newer, older])
    expect(threads[1]).toMatchObject({
      title: "Older conversation",
      status: "archived",
      lastMessageAt: 1_000,
    })
    expect(threads[0]?.title).toBeUndefined()
  })

  it("switchConversation denies switching into another user's thread", async () => {
    const t = initConvexTest()
    const { orgId, asMember, asOtherMember } = await seedOrgWithTwoMembers(t)
    const otherThreadId = await asOtherMember.mutation(
      api.assistant.chat.sendMessage,
      { orgId, text: "not yours", locale: "en" }
    )
    await expect(
      asMember.mutation(api.assistant.chat.switchConversation, {
        orgId,
        threadId: otherThreadId,
      })
    ).rejects.toThrow()
  })

  it("switchConversation archives the current active thread and activates the selected one", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)

    // The switch's lastMessageAt bump is asserted against threadA's original
    // touch below; both come from the same Date.now() the handlers call
    // internally, so two real-clock reads can land in the same millisecond
    // and tie. A fake clock, advanced explicitly right before the switch,
    // makes the "after" reading deterministically later than the "before"
    // one instead of racing the real clock's resolution.
    vi.useFakeTimers({ now: 1_700_000_000_000 })
    try {
      const threadA = await asMember.mutation(api.assistant.chat.sendMessage, {
        orgId,
        text: "a",
        locale: "en",
      })
      // Baseline lastMessageAt, captured right after creation and before every
      // later operation below (finalize, newConversation, a second send, and
      // the switch itself), so the eventual "increased" assertion compares
      // against threadA's ORIGINAL touch, not a value already inflated by one
      // of those steps.
      const beforeSwitch = await asMember.query(
        api.assistant.chat.listThreads,
        { orgId }
      )
      const beforeLastMessageAt = beforeSwitch.find(
        (thread) => thread._id === threadA
      )?.lastMessageAt
      if (beforeLastMessageAt === undefined) throw new Error("seed")

      const messagesA = await asMember.query(api.assistant.chat.listMessages, {
        orgId,
        threadId: threadA,
      })
      const assistantA = messagesA[1]?._id
      if (assistantA === undefined) throw new Error("seed")
      await t.mutation(internal.assistant.chat.finalizeReply, {
        messageId: assistantA,
        status: "complete",
        parts: [{ type: "text", text: "ok" }],
      })
      await asMember.mutation(api.assistant.chat.newConversation, { orgId })

      const threadB = await asMember.mutation(api.assistant.chat.sendMessage, {
        orgId,
        text: "b",
        locale: "en",
      })
      const messagesB = await asMember.query(api.assistant.chat.listMessages, {
        orgId,
        threadId: threadB,
      })
      const assistantB = messagesB[1]?._id
      if (assistantB === undefined) throw new Error("seed")
      await t.mutation(internal.assistant.chat.finalizeReply, {
        messageId: assistantB,
        status: "complete",
        parts: [{ type: "text", text: "ok" }],
      })

      // Advance the clock between threadA's original touch and the switch,
      // so the switch's Date.now() call is a fixed, later instant rather
      // than a second real-clock read racing the first.
      vi.setSystemTime(1_700_000_005_000)

      await asMember.mutation(api.assistant.chat.switchConversation, {
        orgId,
        threadId: threadA,
      })

      const active = await asMember.query(api.assistant.chat.getActiveThread, {
        orgId,
      })
      expect(active?._id).toBe(threadA)
      // The positive half of the busy-guard story: switching bumps the
      // selected thread's lastMessageAt (not just its status), which is what
      // lets it sort back to the top of the next listThreads read.
      expect(active?.lastMessageAt).toBeGreaterThan(beforeLastMessageAt)
      const threads = await asMember.query(api.assistant.chat.listThreads, {
        orgId,
      })
      expect(threads.find((thread) => thread._id === threadB)?.status).toBe(
        "archived"
      )
      // threadA now carries the largest lastMessageAt of the two, so it sorts
      // first: the same recency ordering listThreads relies on.
      expect(threads[0]?._id).toBe(threadA)
    } finally {
      vi.useRealTimers()
    }
  })

  it("listThreads truncates to ASSISTANT_THREAD_LIST_LIMIT, keeping the most recently active", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedOrgWithMember(t)
    const total = ASSISTANT_THREAD_LIST_LIMIT + 1
    const threadIds = await t.run(async (ctx) => {
      const ids = []
      for (let i = 0; i < total; i += 1) {
        ids.push(
          await ctx.db.insert("assistantThreads", {
            orgId,
            userId,
            status: "archived",
            // Ascending: index i is the i-th oldest by activity, so the
            // single dropped thread is deterministically the oldest (index 0).
            lastMessageAt: i,
          })
        )
      }
      return ids
    })

    const asMember = t.withIdentity({ subject: userId })
    const threads = await asMember.query(api.assistant.chat.listThreads, {
      orgId,
    })

    expect(threads).toHaveLength(ASSISTANT_THREAD_LIST_LIMIT)
    const returnedIds = new Set(threads.map((thread) => thread._id))
    expect(returnedIds.has(threadIds[0])).toBe(false)
    for (let i = 1; i < total; i += 1) {
      expect(returnedIds.has(threadIds[i])).toBe(true)
    }
    // Most recently active first: the newest-seeded thread leads the page.
    expect(threads[0]?._id).toBe(threadIds[total - 1])
  })

  it("switchConversation throws assistantBusy when the current active thread is still streaming", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadA = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "a",
      locale: "en",
    })
    const messagesA = await asMember.query(api.assistant.chat.listMessages, {
      orgId,
      threadId: threadA,
    })
    const assistantA = messagesA[1]?._id
    if (assistantA === undefined) throw new Error("seed")
    await t.mutation(internal.assistant.chat.finalizeReply, {
      messageId: assistantA,
      status: "complete",
      parts: [{ type: "text", text: "ok" }],
    })
    await asMember.mutation(api.assistant.chat.newConversation, { orgId })

    // threadB's assistant placeholder is never finalized: it stays the
    // current active thread's still-streaming last message.
    await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "b",
      locale: "en",
    })

    await expect(
      asMember.mutation(api.assistant.chat.switchConversation, {
        orgId,
        threadId: threadA,
      })
    ).rejects.toThrow(/assistantBusy/)
  })

  it("switchConversation to the already-active thread is a no-op", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "hello",
      locale: "en",
    })
    const before = await asMember.query(api.assistant.chat.getActiveThread, {
      orgId,
    })

    await asMember.mutation(api.assistant.chat.switchConversation, {
      orgId,
      threadId,
    })

    const after = await asMember.query(api.assistant.chat.getActiveThread, {
      orgId,
    })
    expect(after).toEqual(before)
  })

  it("setThreadTitle writes the title once and never overwrites an existing one", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "hello",
      locale: "en",
    })

    await t.mutation(internal.assistant.chat.setThreadTitle, {
      threadId,
      title: "Pay gap overview",
    })
    expect(
      (await asMember.query(api.assistant.chat.getActiveThread, { orgId }))
        ?.title
    ).toBe("Pay gap overview")

    await t.mutation(internal.assistant.chat.setThreadTitle, {
      threadId,
      title: "A different title",
    })
    expect(
      (await asMember.query(api.assistant.chat.getActiveThread, { orgId }))
        ?.title
    ).toBe("Pay gap overview")
  })

  it("setThreadTitle is a no-op once the thread no longer exists", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "hello",
      locale: "en",
    })
    await t.run((ctx) => ctx.db.delete(threadId))

    await expect(
      t.mutation(internal.assistant.chat.setThreadTitle, {
        threadId,
        title: "Pay gap overview",
      })
    ).resolves.toBeNull()
  })

  it("deleteConversation denies deleting another user's thread", async () => {
    const t = initConvexTest()
    const { orgId, asMember, asOtherMember } = await seedOrgWithTwoMembers(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "mine",
      locale: "en",
    })
    await expect(
      asOtherMember.mutation(api.assistant.chat.deleteConversation, {
        orgId,
        threadId,
      })
    ).rejects.toThrow()
  })

  it("deleteConversation refuses while the thread's last message is still streaming", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "hello",
      locale: "en",
    })
    // The placeholder assistant reply is never finalized, so it is still
    // "streaming": deleting must refuse rather than delete out from under
    // the generation still writing to it.
    await expect(
      asMember.mutation(api.assistant.chat.deleteConversation, {
        orgId,
        threadId,
      })
    ).rejects.toThrow(/assistantBusy/)
  })

  it("deleteConversation hard-deletes every message and the thread itself", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "hello",
      locale: "en",
    })
    const messages = await asMember.query(api.assistant.chat.listMessages, {
      orgId,
      threadId,
    })
    const assistantId = messages[1]?._id
    if (assistantId === undefined) throw new Error("seed")
    await t.mutation(internal.assistant.chat.finalizeReply, {
      messageId: assistantId,
      status: "complete",
      parts: [{ type: "text", text: "ok" }],
    })

    await asMember.mutation(api.assistant.chat.deleteConversation, {
      orgId,
      threadId,
    })

    await t.run(async (ctx) => {
      expect(await ctx.db.get(threadId)).toBeNull()
      const remaining = await ctx.db
        .query("assistantMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", threadId))
        .collect()
      expect(remaining).toHaveLength(0)
    })
  })

  it("deleteConversation on the active thread leaves no active thread", async () => {
    const t = initConvexTest()
    const { orgId, asMember } = await seedOrgWithMember(t)
    const threadId = await asMember.mutation(api.assistant.chat.sendMessage, {
      orgId,
      text: "hello",
      locale: "en",
    })
    const messages = await asMember.query(api.assistant.chat.listMessages, {
      orgId,
      threadId,
    })
    const assistantId = messages[1]?._id
    if (assistantId === undefined) throw new Error("seed")
    await t.mutation(internal.assistant.chat.finalizeReply, {
      messageId: assistantId,
      status: "complete",
      parts: [{ type: "text", text: "ok" }],
    })

    await asMember.mutation(api.assistant.chat.deleteConversation, {
      orgId,
      threadId,
    })

    expect(
      await asMember.query(api.assistant.chat.getActiveThread, { orgId })
    ).toBeNull()
  })

  it("deleteConversation completes via the rechain for a thread holding more than ERASE_BATCH messages", async () => {
    const t = initConvexTest()
    const { orgId, userId, asMember } = await seedOrgWithMember(t)
    const threadId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("assistantThreads", {
        orgId,
        userId,
        status: "active",
        lastMessageAt: Date.now(),
      })
      for (let i = 0; i < ERASE_BATCH + 1; i += 1) {
        await ctx.db.insert("assistantMessages", {
          orgId,
          userId,
          threadId: id,
          role: "user",
          status: "complete",
          parts: [{ type: "text", text: `m${i}` }],
        })
      }
      return id
    })

    vi.useFakeTimers()
    try {
      await asMember.mutation(api.assistant.chat.deleteConversation, {
        orgId,
        threadId,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)
    } finally {
      vi.useRealTimers()
    }

    // The rechain actually fired: a single transaction only ever deletes one
    // ERASE_BATCH-sized page, so a thread one message over that page must
    // have scheduled a follow-up batch to finish.
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )
    expect(
      scheduled.some((s) => s.name.includes("deleteConversationBatch"))
    ).toBe(true)

    await t.run(async (ctx) => {
      expect(await ctx.db.get(threadId)).toBeNull()
      const remaining = await ctx.db
        .query("assistantMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", threadId))
        .collect()
      expect(remaining).toHaveLength(0)
    })
  })
})
