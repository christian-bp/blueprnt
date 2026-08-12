"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"

// The caller's own conversation history (both statuses, most recently
// active first), read ONLY by the history rail's thread-list node
// (assistant-history.tsx's AssistantHistoryThreadList), which mounts only
// while the rail is open. A deliberately separate hook rather than folded
// into useAssistantChat: the list is bounded and indexed
// (ASSISTANT_THREAD_LIST_LIMIT, listThreads), so subscribing to it for as
// long as the rail stays open is cheap, but useAssistantChat is read by
// every assistant surface on every render, and that hook has no use for the
// full list at all. Keeping the two separate means the chat page and panel
// never pay for a subscription only the rarely-opened rail needs.
export function useAssistantThreads(orgId: string) {
  const threads = useQuery(api.assistant.chat.listThreads, { orgId })
  return { threads: threads ?? [], loading: threads === undefined }
}
