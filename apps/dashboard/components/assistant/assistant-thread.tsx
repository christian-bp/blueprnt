"use client"

import { AiChat02Icon } from "@hugeicons/core-free-icons"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { AssistantSuggestionChip } from "@/components/assistant/assistant-composer"
import { Medallion } from "@/components/medallion"
import {
  AssistantConversation,
  AssistantConversationContent,
  AssistantConversationScrollButton,
} from "@/components/assistant/assistant-conversation"
import {
  AssistantMessage,
  type AssistantChatMessage,
} from "@/components/assistant/assistant-message"
import type { AssistantChatPhase } from "@/hooks/use-assistant-chat"
import {
  ASSISTANT_SUGGESTION_POOL,
  sampleSuggestions,
} from "@/lib/assistant-suggestions"

// The resolving skeleton's chip row: one chip-shaped bar per suggestion
// group, because the settled hero renders exactly one chip per group; the
// widths only vary so the row reads as text rather than as three stamps.
const CHIP_WIDTHS = ["w-32", "w-40", "w-36"]
const CHIP_SKELETONS = ASSISTANT_SUGGESTION_POOL.map((group, index) => ({
  key: group.join("|"),
  width: CHIP_WIDTHS[index % CHIP_WIDTHS.length] ?? "w-36",
}))

// The thread's states: a phase-shaped loading skeleton, an empty state with
// starter suggestions, or the scrollable message list. The composer (its
// sibling in AssistantPanel) is chrome that stays real across all of them;
// only this list has content to be unknown yet.
export function AssistantThread(props: {
  phase: AssistantChatPhase
  messages: AssistantChatMessage[]
  onSuggestion: (text: string) => void
}) {
  const t = useTranslations("dashboard.assistant")
  // Drawn once per mount, above the early returns so the hook order is stable
  // across the thread's three states: the chips must not change while the
  // reader is looking at them, and an empty thread that gains its first
  // message and loses it again is one mount, not two.
  const [chips] = useState(() => sampleSuggestions(ASSISTANT_SUGGESTION_POOL))

  if (props.phase === "resolving") {
    // Nobody knows yet whether a conversation exists, so this beat mirrors
    // the surface's DEFAULT view, the centered empty hero, built from the
    // same Empty anatomy with bars in the real type's line boxes (title and
    // chips measure what the settled hero measures). Message-shaped bars
    // here flashed bubbles at a fresh visitor whose settled state is this
    // hero, which read as content appearing and vanishing.
    return (
      <Empty className="min-h-0 flex-1">
        <EmptyHeader>
          {/* The medallion is chrome the hero always wears, so it renders
              real here rather than as a gray bar (the skeleton convention
              for static chrome). */}
          <EmptyMedia>
            <Medallion icon={AiChat02Icon} size="lg" />
          </EmptyMedia>
          {/* text-lg, matching the settled hero below: the vendor default
              (text-sm) suits a register's empty state, but this is the
              surface's full-pane landing and needs a step of hierarchy over
              its description. */}
          <EmptyTitle className="text-lg">
            <span className="flex h-7 items-center justify-center">
              <Skeleton className="h-5 w-44" />
            </span>
          </EmptyTitle>
          <EmptyDescription>
            <span className="flex h-6 items-center justify-center">
              <Skeleton className="h-4 w-64 max-w-full" />
            </span>
          </EmptyDescription>
        </EmptyHeader>
        {/* max-w-2xl, here and in the settled hero below, so the chips can
            share rows instead of stacking one per line under the vendor's
            max-w-sm; the two must stay identical for the skeleton to
            measure what the hero measures. */}
        <EmptyContent className="max-w-2xl">
          <div className="flex flex-wrap justify-center gap-2">
            {CHIP_SKELETONS.map((chip) => (
              <Skeleton
                key={chip.key}
                className={`h-7 rounded-full ${chip.width}`}
              />
            ))}
          </div>
        </EmptyContent>
      </Empty>
    )
  }

  if (props.phase === "loadingMessages") {
    // A conversation exists and its list is in flight: message-height bars
    // in the message layout are the honest shape, and nothing reflows when
    // the list arrives. min-h-0 alongside flex-1 keeps this in the same
    // bounded-height chain as the loaded thread (page.tsx), so a short
    // viewport shrinks it instead of forcing a page-level scrollbar.
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
          <EmptyMedia>
            <Medallion icon={AiChat02Icon} size="lg" />
          </EmptyMedia>
          {/* text-lg: see the resolving skeleton's note; the two must match
              for the skeleton to measure what the hero measures. */}
          <EmptyTitle className="text-lg">{t("emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
        </EmptyHeader>
        {/* max-w-2xl: the vendor's max-w-sm fits one chip per line, which
            stacked all three; this lets two share a row while the heading
            keeps its narrow hero measure. Matches the resolving skeleton's
            EmptyContent above. */}
        <EmptyContent className="max-w-2xl">
          <div className="flex flex-wrap justify-center gap-2">
            {chips.map((key) => (
              <AssistantSuggestionChip
                key={key}
                label={t(key)}
                onSelect={() => props.onSuggestion(t(key))}
              />
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
