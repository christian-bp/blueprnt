import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

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
})
