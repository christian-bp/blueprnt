"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"

// The caller's own conversation history (both statuses, most recently
// active first), read ONLY by the history panel's thread-list node
// (assistant-history.tsx's AssistantHistoryThreadList), which stays mounted
// with the panel whether it is open or collapsed: the collapse is a width
// slide that clips real rows, so the list must keep rendering through it.
// A deliberately separate hook rather than folded into useAssistantChat:
// the list is bounded and indexed (ASSISTANT_THREAD_LIST_LIMIT,
// listThreads), so the standing subscription is cheap, but useAssistantChat
// is read by every assistant surface on every render, and that hook has no
// use for the full list at all. Keeping the two separate means the chat
// page never pays for a subscription only the panel's own thread-list node
// needs.
export function useAssistantThreads(orgId: string) {
  const threads = useQuery(api.assistant.chat.listThreads, { orgId })
  return { threads: threads ?? [], loading: threads === undefined }
}
