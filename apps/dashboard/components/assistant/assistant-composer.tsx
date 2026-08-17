"use client"

import { ArrowUp02Icon, StopIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group"
import { useTranslations } from "next-intl"
import { useState } from "react"

// Call-site override, not a vendored-file edit: the assistant surfaces
// deliberately deviate from the app's default input shell (rounded-md,
// border-input, shadow-xs, a ring-ring/50 focus ring) to read as a chat pill
// instead of a form field, matching the reference chatbot template's
// InputGroup (rounded-2xl, a transparent border over a bg-input/50 tint, no
// shadow, a softer ring-ring/30 focus). Shared by AssistantComposer and
// AssistantPrompt so the two composers never drift apart.
export const ASSISTANT_INPUT_GROUP_CLASS =
  "rounded-2xl border-transparent bg-input/50 shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-ring/30"
// The vendored Textarea already auto-grows via field-sizing-content +
// min-h-16 (identical to the template's), so only the padding needs the
// template's roomier p-3.5 in place of the vendored px-2.5/py-2.
export const ASSISTANT_TEXTAREA_CLASS = "p-3.5"
// The send/stop control's row: `align="block-end"` (not "inline-end") puts it
// in its own row below the textarea instead of vertically centered beside it,
// which is what gives the pill the template's two-row feel; `justify-end`
// overrides the addon's own default left alignment so the round button sits
// in the pill's lower-right corner, matching the reference chatbot template
// and midday's overview prompt. Shared so both composers can never drift
// into different anatomies.
export const ASSISTANT_SEND_ROW_CLASS = "justify-end"
// Round rather than the vendored square icon-button shape, matching the same
// reference: a send/stop control reads as the pill's own action, not a form
// button docked to its edge.
export const ASSISTANT_SEND_BUTTON_CLASS = "rounded-full"

// The compact pill: one row, with the send control beside the field instead of
// under it. For a surface where the prompt is an entry point rather than the
// page's main event (the guide's hero), where the two-row pill reads as a
// large empty box under the title instead of an invitation to type. The
// vendored textarea auto-grows on field-sizing-content, so dropping its
// min-h-16 floor costs nothing: a pasted paragraph still expands the pill.
export const ASSISTANT_TEXTAREA_COMPACT_CLASS = "min-h-0 p-3"

// A starter suggestion under the input, shared by the overview prompt and the
// thread's empty state so the two can never drift apart.
//
// A real button, because the chip DOES something in place (it sends the
// question) rather than going somewhere: that is what makes it keyboard
// operable and announced correctly, and a clickable div would be strictly
// worse. But it is deliberately not dressed as one. A suggestion is an offer
// subordinate to the field above it, so it takes the filled secondary tint
// with muted text instead of the outline variant, whose border and weight
// read as a genuine secondary action and competed with the page's real
// buttons. rounded-full is the same call-site chat idiom the send control
// already follows.
export function AssistantSuggestionChip({
  label,
  disabled,
  onSelect,
}: {
  label: string
  disabled?: boolean
  onSelect: () => void
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={disabled}
      onClick={onSelect}
      className="rounded-full font-normal text-muted-foreground hover:text-foreground"
    >
      {label}
    </Button>
  )
}

// The assistant page's presentational input: send/stop live in the same
// slot (only one control is ever mounted, matching busy), and Enter submits
// while Shift+Enter and an in-progress IME composition both fall through to
// a plain newline. AssistantPanel owns the data and passes props.
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
    <div className="pt-3">
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
              send()
            }
          }}
        />
        <InputGroupAddon align="block-end" className={ASSISTANT_SEND_ROW_CLASS}>
          {props.busy ? (
            <InputGroupButton
              size="icon-sm"
              variant="outline"
              className={ASSISTANT_SEND_BUTTON_CLASS}
              onClick={props.onStop}
              aria-label={t("stop")}
            >
              <HugeiconsIcon icon={StopIcon} strokeWidth={2} />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              size="icon-sm"
              variant={text.trim() === "" ? "secondary" : "default"}
              className={ASSISTANT_SEND_BUTTON_CLASS}
              onClick={send}
              disabled={!canSend}
              aria-label={t("send")}
            >
              <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      {/* Reserved-minimum slot, not a fixed height: an appearing error or
          the disclaimer never reflows the thread above, but wrapped text at
          narrow widths can still grow the slot downward instead of
          clipping. */}
      <p className="min-h-4 pt-1 text-muted-foreground text-xs">
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
