"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"
import { useState } from "react"
import {
  AssistantConversation,
  AssistantConversationContent,
  AssistantConversationScrollButton,
} from "@/components/assistant/assistant-conversation"
import {
  AssistantMessage,
  type AssistantChatMessage,
} from "@/components/assistant/assistant-message"
import {
  ASSISTANT_SUGGESTION_POOL,
  sampleSuggestions,
} from "@/lib/assistant-suggestions"

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
  // Drawn once per mount, above the early returns so the hook order is stable
  // across the thread's three states: the chips must not change while the
  // reader is looking at them, and an empty thread that gains its first
  // message and loses it again is one mount, not two.
  const [chips] = useState(() => sampleSuggestions(ASSISTANT_SUGGESTION_POOL))

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
            {chips.map((key) => (
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
    <AssistantConversation className="flex-1">
      {/* px-8, matching the composer's own wrapper (assistant-panel.tsx) on
          the same max-w-3xl: the two columns' visible content lines up
          left/right, not just their outer box. */}
      <AssistantConversationContent>
        {props.messages.map((message) => (
          <AssistantMessage key={message._id} message={message} />
        ))}
      </AssistantConversationContent>
      <AssistantConversationScrollButton />
    </AssistantConversation>
  )
}
