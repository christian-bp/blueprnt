"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"
import {
  AssistantMessage,
  type AssistantChatMessage,
} from "@/components/assistant/assistant-message"

const SUGGESTION_KEYS = [
  "suggestionCriterion",
  "suggestionGapTrend",
  "suggestionPayMapping",
] as const

// The thread's three states: a content-shaped loading skeleton, an empty
// state with starter suggestions, or the scrollable message list. The
// composer (its sibling in AssistantPanel) is chrome that stays real across
// all three; only this list has content to be unknown yet.
export function AssistantThread(props: {
  loading: boolean
  messages: AssistantChatMessage[]
  onSuggestion: (text: string) => void
}) {
  const t = useTranslations("dashboard.assistant")

  if (props.loading) {
    // Content-shaped skeleton: two message-height bars in the same layout so
    // nothing reflows when data arrives.
    return (
      <div className="flex flex-1 flex-col gap-4 py-4">
        <Skeleton className="h-10 w-3/5 self-end" />
        <Skeleton className="h-16 w-4/5" />
      </div>
    )
  }

  if (props.messages.length === 0) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTION_KEYS.map((key) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                onClick={() => props.onSuggestion(t(key))}
              >
                {t(key)}
              </Button>
            ))}
          </div>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <MessageScrollerProvider>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent className="flex flex-col gap-4 py-4">
            {props.messages.map((message) => (
              <MessageScrollerItem
                key={message._id}
                messageId={message._id}
                scrollAnchor={message.role === "user"}
              >
                <AssistantMessage message={message} />
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton aria-label={t("title")} />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
