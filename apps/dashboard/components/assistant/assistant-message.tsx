"use client"

import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import { Message, MessageContent } from "@workspace/ui/components/message"
import { Spinner } from "@workspace/ui/components/spinner"
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
        chart: "headcountTrend" | "payGapTrend"
        summary: string
      }
  >
  // Set only on a failed reply; a known code (e.g. the personal-data screen)
  // gets its own explanation, anything else falls back to the generic
  // failure text.
  errorCode?: string
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
          <Bubble>
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
            className="flex items-center py-1"
          >
            <Spinner className="size-4" />
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
                // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only within a message, so index is stable
                <AssistantMarkdown key={index} text={part.text} />
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
          </>
        )}
      </MessageContent>
    </Message>
  )
}
