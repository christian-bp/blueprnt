"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useMutation } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { AssistantComposer } from "@/components/assistant/assistant-composer"
import { AssistantThread } from "@/components/assistant/assistant-thread"
import { useOrganization } from "@/components/org-context"
import { useAssistantChat } from "@/hooks/use-assistant-chat"
import { translateErrorCode } from "@/lib/convex-error"
import { toast } from "@/lib/toast"

// The assistant page's data owner: reads the shared chat hook (also read by
// AssistantPage, so a value like `busy` can never lag between the two) and
// exposes send/stop.
export function AssistantPanel() {
  const { orgId } = useOrganization()
  const locale = useLocale()
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const { messages, loading, busy, last } = useAssistantChat(orgId)
  const sendMessage = useMutation(api.assistant.chat.sendMessage)
  const stopGeneration = useMutation(api.assistant.chat.stopGeneration)
  const [sendError, setSendError] = useState<string | undefined>(undefined)

  const handleSend = async (text: string) => {
    setSendError(undefined)
    try {
      await sendMessage({ orgId, text, locale })
    } catch (error) {
      setSendError(translateErrorCode(error, tErrors))
    }
  }
  const handleStop = async () => {
    if (busy && last !== undefined) {
      try {
        await stopGeneration({ orgId, messageId: last._id })
      } catch {
        toast.error(tToast("error"))
      }
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AssistantThread
        loading={loading}
        messages={messages}
        onSuggestion={handleSend}
      />
      {/* px-8, matching AssistantThread's own MessageScrollerContent inset
          (assistant-thread.tsx) on the same max-w-2xl: the composer pill and
          the message column must keep the same left/right edges. */}
      <div className="mx-auto w-full max-w-2xl px-8">
        <AssistantComposer
          busy={busy}
          onSend={handleSend}
          onStop={handleStop}
          error={sendError}
        />
      </div>
    </div>
  )
}
