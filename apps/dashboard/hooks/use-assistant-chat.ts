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
// deliberately not exposed here: it is read only by the history panel's own
// thread-list node (AssistantHistoryPanel), via its own useAssistantThreads
// hook, so this hook (read by every chat render) never pays for that extra
// subscription.
// The thread area's three visual states. resolving: nobody knows yet whether
// a conversation exists, so the surface mirrors its DEFAULT view (the empty
// hero) rather than promising messages; loadingMessages: a conversation
// exists and its list is in flight, so message-shaped loading is honest;
// ready: empty state or messages. Derived in the hook so AssistantPanel and
// the page can never read the boundary differently.
export type AssistantChatPhase = "resolving" | "loadingMessages" | "ready"

export function useAssistantChat(orgId: string) {
  const thread = useQuery(api.assistant.chat.getActiveThread, { orgId })
  const messages = useQuery(
    api.assistant.chat.listMessages,
    thread ? { orgId, threadId: thread._id } : "skip"
  )
  const phase: AssistantChatPhase =
    thread === undefined
      ? "resolving"
      : thread !== null && messages === undefined
        ? "loadingMessages"
        : "ready"
  const loading = phase !== "ready"
  const resolvedMessages = thread === null ? [] : (messages ?? [])
  const last = resolvedMessages.at(-1)
  const busy = last?.status === "streaming"
  return {
    thread,
    messages: resolvedMessages,
    phase,
    loading,
    busy,
    last,
    title: thread?.title,
  }
}
