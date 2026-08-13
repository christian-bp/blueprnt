"use client"

import { ArrowDown02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useTranslations } from "next-intl"
import type { ComponentProps } from "react"
import { useCallback } from "react"
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom"
import { SPRING } from "@/lib/motion"

// The message thread's scroll container (use-stick-to-bottom): instant on
// mount/thread switch, a spring follow while a reply streams, and
// cancel-on-scroll-up until the user returns to bottom, all owned by the
// library. min-h-0 is this component's own default (mirrors the vendor
// MessageScroller it replaces) so a caller only ever adds flex-1.
export type AssistantConversationProps = ComponentProps<typeof StickToBottom>

export function AssistantConversation({
  className,
  ...props
}: AssistantConversationProps) {
  // The library has no notion of the app's MotionConfig, so reduced motion
  // is read explicitly here and forces instant positioning instead of the
  // spring follow.
  const reducedMotion = useReducedMotion()
  const behavior = reducedMotion ? "instant" : "smooth"
  return (
    <StickToBottom
      data-slot="assistant-conversation"
      className={cn("relative min-h-0 overflow-hidden", className)}
      initial={behavior}
      resize={behavior}
      role="log"
      {...props}
    />
  )
}

export type AssistantConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>

// scrollClassName lands on the library's own scroll element (the wrapper
// StickToBottom.Content renders around this div), so the scrollbar
// treatment targets the element that actually scrolls rather than leaning
// on CSS inheritance from an ancestor that never scrolls itself.
// scrollbar-gutter is left to the library, which already reserves it
// (both edges) via an inline style on that same element.
export function AssistantConversationContent({
  className,
  ...props
}: AssistantConversationContentProps) {
  return (
    <StickToBottom.Content
      data-slot="assistant-conversation-content"
      scrollClassName="overflow-y-auto overscroll-contain scroll-fade-b scrollbar-thin"
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-6",
        className
      )}
      {...props}
    />
  )
}

export type AssistantConversationScrollButtonProps = ComponentProps<
  typeof Button
>

// Appears only once the user has scrolled away from the bottom
// (useStickToBottomContext's isAtBottom); clicking resumes following.
// Mount/unmount is a legitimate enter/leave, so it springs rather than
// popping (matches the vendor button's own appear/disappear transition).
export function AssistantConversationScrollButton({
  className,
  ...props
}: AssistantConversationScrollButtonProps) {
  const t = useTranslations("dashboard.assistant")
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()
  const handleClick = useCallback(() => {
    scrollToBottom()
  }, [scrollToBottom])

  return (
    <AnimatePresence>
      {!isAtBottom && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={SPRING}
          className="absolute bottom-4 left-1/2 -translate-x-1/2"
        >
          <Button
            data-slot="assistant-conversation-scroll-button"
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t("scrollToBottom")}
            onClick={handleClick}
            className={className}
            {...props}
          >
            <HugeiconsIcon icon={ArrowDown02Icon} strokeWidth={2} />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
