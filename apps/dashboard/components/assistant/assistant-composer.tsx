"use client"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group"
import { useTranslations } from "next-intl"
import { useState } from "react"

// The assistant page's presentational input: send/stop live in the same
// slot (only one control is ever mounted, matching busy), and Enter submits
// while Shift+Enter and an in-progress IME composition both fall through to
// a plain newline. AssistantPanel (Task 12) owns the data and passes props.
export function AssistantComposer(props: {
  busy: boolean
  onSend: (text: string) => void
  onStop: () => void
  error?: string
}) {
  const t = useTranslations("dashboard.assistant")
  const [text, setText] = useState("")
  const canSend = !props.busy && text.trim() !== ""

  const send = () => {
    if (!canSend) return
    props.onSend(text.trim())
    setText("")
  }

  return (
    <div className="border-t pt-3">
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
              send()
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          {props.busy ? (
            <InputGroupButton onClick={props.onStop} aria-label={t("stop")}>
              {t("stop")}
            </InputGroupButton>
          ) : (
            <InputGroupButton
              onClick={send}
              disabled={!canSend}
              aria-label={t("send")}
            >
              {t("send")}
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      {/* Fixed-height slot: an appearing error or the disclaimer never
          reflows the thread above. */}
      <p className="h-4 pt-1 text-muted-foreground text-xs">
        {props.error !== undefined ? (
          <span role="alert" className="text-destructive">
            {props.error}
          </span>
        ) : (
          t("disclaimer")
        )}
      </p>
    </div>
  )
}
