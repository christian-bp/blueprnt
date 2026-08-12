"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group"
import { useMutation } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useOrganization } from "@/components/org-context"
import { translateErrorCode } from "@/lib/convex-error"

const SUGGESTION_KEYS = [
  "suggestionCriterion",
  "suggestionGapTrend",
  "suggestionPayMapping",
] as const

// The overview's entry into the assistant (midday-style: the prompt lives on
// the landing page, the conversation lives on /assistant). Because messages
// persist in Convex, submit-then-navigate needs no state handoff: the reply
// is already streaming into the thread when the page mounts.
export function AssistantPrompt() {
  const t = useTranslations("dashboard.assistant")
  const tErrors = useTranslations("errors")
  const locale = useLocale()
  const router = useRouter()
  const { orgId } = useOrganization()
  const sendMessage = useMutation(api.assistant.chat.sendMessage)
  const [text, setText] = useState("")
  const [error, setError] = useState<string | undefined>(undefined)
  const [sending, setSending] = useState(false)

  const send = async (message: string) => {
    const trimmed = message.trim()
    if (trimmed === "" || sending) return
    setSending(true)
    setError(undefined)
    try {
      await sendMessage({ orgId, text: trimmed, locale })
      router.push("/assistant")
      // No setSending(false) on success: the navigation above unmounts this
      // component, and clearing it first would re-enable the button for a
      // single flash before the route change lands.
    } catch (cause) {
      setError(translateErrorCode(cause, tErrors))
      setSending(false)
    }
  }

  return (
    // A plain div, not a <section>: like the header block above it on the
    // overview page, this is one tightly-related composite control (input,
    // suggestions, error slot), not a "band" the page's between-band gap-4
    // rhythm applies to.
    <div className="flex flex-col gap-2">
      <InputGroup>
        <InputGroupTextarea
          value={text}
          placeholder={t("inputPlaceholder")}
          rows={1}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              void send(text)
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            onClick={() => void send(text)}
            disabled={text.trim() === "" || sending}
            aria-label={t("send")}
          >
            {t("send")}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <div className="flex flex-wrap items-center gap-2">
        {SUGGESTION_KEYS.map((key) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            disabled={sending}
            onClick={() => void send(t(key))}
          >
            {t(key)}
          </Button>
        ))}
      </div>
      {/* Fixed-height slot so an appearing error never reflows the page. */}
      <p className="h-4 text-destructive text-xs">{error ?? ""}</p>
    </div>
  )
}
