"use client"

import type { AssistantChartKind } from "@workspace/backend/convex/assistant/tables"
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import { Message, MessageContent } from "@workspace/ui/components/message"
import { useTranslations } from "next-intl"
import { AssistantChartPart } from "@/components/assistant/assistant-chart-part"
import { AssistantMarkdown } from "@/components/assistant/assistant-markdown"
import { useStreamReveal } from "@/hooks/use-stream-reveal"
import { ASSISTANT_PERSONAL_DATA_ERROR_CODE } from "@/lib/convex-error"

// The listMessages element shape every assistant surface renders. A user
// message carries only text; an assistant reply's parts are append-only
// (streamed in), so their array index is a stable React key.
export interface AssistantChatMessage {
  _id: string
  role: "user" | "assistant"
  status: "complete" | "streaming" | "failed" | "stopped"
  parts: Array<
    | { type: "text"; text: string }
    | {
        type: "chart"
        chart: AssistantChartKind
        summary: string
      }
  >
  // Set only on a failed reply; a known code (e.g. the personal-data screen)
  // gets its own explanation, anything else falls back to the generic
  // failure text.
  errorCode?: string
  // Transient in-progress signal while streaming (e.g. a tool is running).
  // Never present on a finalized reply.
  activity?: "checkingData"
}

export function AssistantMessage({
  message,
  isLastMessage = false,
}: {
  message: AssistantChatMessage
  // True only for the thread's last message: pacing (see useStreamReveal
  // below) applies there and nowhere else, so history never re-paces on
  // mount and an earlier message that happens to still say "streaming"
  // (there should only ever be one) never fights the current one for it.
  isLastMessage?: boolean
}) {
  const t = useTranslations("dashboard.assistant")
  const tErrors = useTranslations("errors")

  // The parts array's text so far, concatenated in arrival order with chart
  // parts contributing no characters: this is what generate.ts's snapshot()
  // actually produces (completed text/chart parts followed by, at most, one
  // still-growing text part), and concatenating it into one string lets a
  // single pacing chase cover every text part in order, not only the
  // trailing one. Chart parts don't need their own reveal, only a gate: see
  // the cumulative offset below.
  const combinedText = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
  // Only the thread's last message ever paces: a message that is not the
  // last one is always rendered as "stopped" here regardless of its real
  // status, both to snap history straight to its full text and to defend
  // against an earlier message that happens to still say "streaming" (there
  // should only ever be one) never fighting the current one for pacing.
  const revealedText = useStreamReveal(
    combinedText,
    isLastMessage ? message.status : "stopped"
  )

  // Walks the parts in order, tracking how much combined text precedes each
  // one (offset): a text part shows only the slice of itself that falls
  // within revealedText's length, and a chart part renders only once offset
  // (everything ahead of it) has fully revealed, so a chart can never
  // appear before the text that precedes it. Unpaced messages (isLastMessage
  // false, or not streaming) reach here with revealedText already equal to
  // combinedText, so every slice and gate resolves to "fully shown" and
  // nothing changes for them.
  let offset = 0
  const partNodes = message.parts.map((part, index) => {
    if (part.type === "text") {
      const start = offset
      offset += part.text.length
      const shown = part.text.slice(
        0,
        Math.max(0, Math.min(part.text.length, revealedText.length - start))
      )
      return (
        <AssistantMarkdown
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only within a message, so index is stable
          key={index}
          text={shown}
          isAnimating={message.status === "streaming"}
        />
      )
    }
    if (revealedText.length < offset) return null
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only within a message, so index is stable
      <AssistantChartPart key={index} chart={part.chart} />
    )
  })

  if (message.role === "user") {
    return (
      <Message align="end">
        <MessageContent>
          <Bubble variant="muted">
            <BubbleContent>
              {message.parts.map((part, index) =>
                part.type === "text" ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only within a message, so index is stable
                  <span key={index}>{part.text}</span>
                ) : null
              )}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    )
  }

  return (
    <Message align="start">
      <MessageContent>
        {message.status === "streaming" && message.parts.length === 0 ? (
          <div
            data-testid="assistant-pending"
            className="shimmer flex items-center gap-2 px-3 text-muted-foreground text-sm"
          >
            {message.activity === "checkingData"
              ? t("checkingData")
              : t("thinking")}
          </div>
        ) : message.status === "failed" ? (
          <p className="text-destructive text-sm">
            {message.errorCode === ASSISTANT_PERSONAL_DATA_ERROR_CODE
              ? tErrors("assistantPersonalData")
              : t("failed")}
          </p>
        ) : (
          <>
            {partNodes}
            {message.status === "stopped" ? (
              <p className="text-muted-foreground text-xs">
                {t("stoppedNote")}
              </p>
            ) : null}
            {message.status === "streaming" &&
            message.activity === "checkingData" ? (
              <div
                data-testid="assistant-activity"
                className="shimmer flex items-center gap-2 px-3 text-muted-foreground text-sm"
              >
                {t("checkingData")}
              </div>
            ) : null}
          </>
        )}
      </MessageContent>
    </Message>
  )
}
