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
import { SUGGESTION_KEYS } from "@/components/assistant/assistant-composer"
import {
  AssistantMessage,
  type AssistantChatMessage,
} from "@/components/assistant/assistant-message"

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
    // nothing reflows when data arrives. min-h-0 alongside flex-1 keeps this
    // in the same bounded-height chain as the loaded thread (page.tsx), so a
    // short viewport shrinks it instead of forcing a page-level scrollbar.
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 py-4">
        <Skeleton className="h-10 w-3/5 self-end" />
        <Skeleton className="h-16 w-4/5" />
      </div>
    )
  }

  if (props.messages.length === 0) {
    return (
      // min-h-0: Empty (vendor) omits it, but this sits in the same bounded
      // flex chain as the loaded thread (page.tsx), so it must be able to
      // shrink like everything else there.
      <Empty className="min-h-0 flex-1">
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
          {/* px-8: a chart card (TrendPanel, "bleed") fills this column edge
              to edge, so its rounded corner must clear the viewport's own
              paint containment (contain-content, MessageScrollerViewport) or
              that border gets cut. The composer's own wrapper
              (assistant-panel.tsx) carries the same px-8, on the same
              max-w-3xl, so the two columns' visible content still lines up
              left/right, not just their outer box. */}
          <MessageScrollerContent className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-6">
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
        {/* No aria-label override: an explicit one wins over subtree text in
            accessible-name computation and would erase the vendor's own
            "Scroll to end" sr-only label with the wrong name. */}
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
