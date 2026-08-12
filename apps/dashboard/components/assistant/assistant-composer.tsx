"use client"

// Stub: Task 14 replaces this with the real composer (input, send/stop
// controls, inline error). Kept minimal here so AssistantPanel (its data
// owner) compiles and can be wired-tested ahead of that task.
export function AssistantComposer(props: {
  busy: boolean
  onSend: (text: string) => void
  onStop: () => void
  error?: string
}) {
  void props
  return <div data-slot="assistant-composer-stub" />
}
