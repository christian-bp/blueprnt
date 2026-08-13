"use client"

import { ArrowUp02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
import {
  ASSISTANT_INPUT_GROUP_CLASS,
  ASSISTANT_SEND_BUTTON_CLASS,
  ASSISTANT_SEND_ROW_CLASS,
  ASSISTANT_TEXTAREA_CLASS,
  SUGGESTION_KEYS,
} from "@/components/assistant/assistant-composer"
import { useOrganization } from "@/components/org-context"
import { translateErrorCode } from "@/lib/convex-error"

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
      // fresh: true, always: the overview prompt is the app's "start a new
      // conversation" entry point, never a continuation of whatever thread
      // happens to still be active.
      await sendMessage({ orgId, text: trimmed, locale, fresh: true })
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
      {/* Deliberate deviation from the app's default input shell to match
          the chat pill treatment (call-site override per design-system
          rules). */}
      <InputGroup className={ASSISTANT_INPUT_GROUP_CLASS}>
        <InputGroupTextarea
          className={ASSISTANT_TEXTAREA_CLASS}
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
        <InputGroupAddon align="block-end" className={ASSISTANT_SEND_ROW_CLASS}>
          <InputGroupButton
            size="icon-sm"
            variant={text.trim() === "" ? "secondary" : "default"}
            className={ASSISTANT_SEND_BUTTON_CLASS}
            onClick={() => void send(text)}
            disabled={text.trim() === "" || sending}
            aria-label={t("send")}
          >
            <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
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
      {/* Reserved-minimum slot, not a fixed height: an appearing error never
          reflows the page, but wrapped text can still grow the slot
          downward instead of overlapping the row below. */}
      <p className="min-h-4 text-destructive text-xs">
        {error !== undefined ? <span role="alert">{error}</span> : ""}
      </p>
    </div>
  )
}
