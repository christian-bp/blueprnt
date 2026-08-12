"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"

// Reads the two reactive queries every assistant surface derives from (the
// caller's active conversation and its messages) and derives the state they
// all need: whether it is still loading, the resolved message list, and
// whether a reply is currently streaming. Shared by AssistantPanel and
// AssistantPage so a value like `busy` can never lag between two components
// that read it separately; Convex dedupes the identical subscriptions, so a
// second caller costs nothing extra.
//
// thread undefined = still loading. thread null = no conversation yet (the
// message list stays skipped, so `messages` resolves to the empty array
// without a second round trip).
//
// `title` is the active thread's AI-generated label, undefined until the
// title-generation pipeline finishes (or forever, on a thread whose first
// reply never completed): AssistantTitle renders nothing in that case. The
// full conversation HISTORY (every thread, not just the active one) is
// deliberately not exposed here: it is read only by the history rail's own
// thread-list node, via its own useAssistantThreads hook, so this hook (read
// by every chat render) never pays for that extra subscription.
export function useAssistantChat(orgId: string) {
  const thread = useQuery(api.assistant.chat.getActiveThread, { orgId })
  const messages = useQuery(
    api.assistant.chat.listMessages,
    thread ? { orgId, threadId: thread._id } : "skip"
  )
  const loading =
    thread === undefined || (thread !== null && messages === undefined)
  const resolvedMessages = thread === null ? [] : (messages ?? [])
  const last = resolvedMessages.at(-1)
  const busy = last?.status === "streaming"
  return {
    thread,
    messages: resolvedMessages,
    loading,
    busy,
    last,
    title: thread?.title,
  }
}
