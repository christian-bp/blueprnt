"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { AssistantComposer } from "@/components/assistant/assistant-composer"
import { AssistantThread } from "@/components/assistant/assistant-thread"
import { useOrganization } from "@/components/org-context"
import { translateErrorCode } from "@/lib/convex-error"

// The assistant page's data owner: resolves the caller's active conversation
// and its messages, derives whether a reply is currently streaming, and
// exposes send/stop. The page keeps the New conversation button in its
// PageHeader action slot (house convention), so `busy` is reported upward
// through onBusyChange rather than the button living in here; the button
// itself needs to disable while a reply streams (archiving the active
// thread mid-stream would silently orphan it), and this is the simplest way
// to get that one boolean to the page without moving the whole data-owner
// role there.
export function AssistantPanel(props: {
  onBusyChange?: (busy: boolean) => void
}) {
  const { orgId } = useOrganization()
  const locale = useLocale()
  const tErrors = useTranslations("errors")
  const thread = useQuery(api.assistant.chat.getActiveThread, { orgId })
  const messages = useQuery(
    api.assistant.chat.listMessages,
    thread ? { orgId, threadId: thread._id } : "skip"
  )
  const sendMessage = useMutation(api.assistant.chat.sendMessage)
  const stopGeneration = useMutation(api.assistant.chat.stopGeneration)
  const [sendError, setSendError] = useState<string | undefined>(undefined)

  // thread === undefined: loading. thread === null: no conversation yet (the
  // thread view shows the empty state; messages stays skipped).
  const loading =
    thread === undefined || (thread !== null && messages === undefined)
  const resolvedMessages = thread === null ? [] : (messages ?? [])
  const last = resolvedMessages.at(-1)
  const busy = last?.status === "streaming"

  const { onBusyChange } = props
  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])

  const handleSend = async (text: string) => {
    setSendError(undefined)
    try {
      await sendMessage({ orgId, text, locale })
    } catch (error) {
      setSendError(translateErrorCode(error, tErrors))
    }
  }
  const handleStop = () => {
    if (busy && last !== undefined) {
      void stopGeneration({ orgId, messageId: last._id })
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AssistantThread
        loading={loading}
        messages={resolvedMessages}
        onSuggestion={handleSend}
      />
      <AssistantComposer
        busy={busy}
        onSend={handleSend}
        onStop={handleStop}
        error={sendError}
      />
    </div>
  )
}
