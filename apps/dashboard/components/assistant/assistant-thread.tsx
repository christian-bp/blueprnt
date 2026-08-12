"use client"

// Stub: Task 13 replaces this with the real thread view (loading skeleton,
// empty state with suggestion chips, the message list with live chart
// parts). Kept minimal here so AssistantPanel (its data owner) compiles and
// can be wired-tested ahead of that task.

export interface AssistantChatMessage {
  _id: string
  role: "user" | "assistant"
  status: "complete" | "streaming" | "failed" | "stopped"
  parts: Array<
    | { type: "text"; text: string }
    | {
        type: "chart"
        chart: "headcountTrend" | "payGapTrend"
        summary: string
      }
  >
  errorCode?: string
}

export function AssistantThread(props: {
  loading: boolean
  messages: AssistantChatMessage[]
  onSuggestion: (text: string) => void
}) {
  void props
  return <div data-slot="assistant-thread-stub" />
}
