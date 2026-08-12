"use client"

import type { AssistantChartKind } from "@workspace/backend/convex/assistant/tables"
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import { Message, MessageContent } from "@workspace/ui/components/message"
import { useTranslations } from "next-intl"
import { AssistantChartPart } from "@/components/assistant/assistant-chart-part"
import { AssistantMarkdown } from "@/components/assistant/assistant-markdown"
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
}: {
  message: AssistantChatMessage
}) {
  const t = useTranslations("dashboard.assistant")
  const tErrors = useTranslations("errors")

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
            {message.parts.map((part, index) =>
              part.type === "text" ? (
                <AssistantMarkdown
                  // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only within a message, so index is stable
                  key={index}
                  text={part.text}
                  isAnimating={message.status === "streaming"}
                />
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only within a message, so index is stable
                <AssistantChartPart key={index} chart={part.chart} />
              )
            )}
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
