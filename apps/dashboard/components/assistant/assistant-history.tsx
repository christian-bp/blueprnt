"use client"

import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useMutation } from "convex/react"
import { AnimatePresence, motion } from "motion/react"
import type { Variants } from "motion/react"
import { useFormatter, useTranslations } from "next-intl"
import { useOrganization } from "@/components/org-context"
import { useAssistantThreads } from "@/hooks/use-assistant-threads"
import { SPRING } from "@/lib/motion"
import { toast } from "@/lib/toast"

// The rail's open width and the gap it carries to the main column, both
// carried by the rail's OWN animated geometry rather than a flex `gap` on
// the row: a container gap does not collapse with a shrinking flex item
// (docs/ui-animation.md #3), so a `gap-*` on the row would still reserve
// dead space once the rail's width reached 0. Animating both together means
// closed truly means zero footprint, no gap artifact left behind.
const RAIL_WIDTH = 280
const RAIL_GAP = 16

// Row count for the loading skeleton, not the list's own page size: the list
// is unpaginated and never grows past ASSISTANT_THREAD_LIST_LIMIT, so this
// is purely how many placeholder rows read as "a list" without overfilling
// the rail before real data arrives.
const HISTORY_SKELETON_ROW_KEYS = ["s1", "s2", "s3"] as const

// The content's own exit-fade duration. The rail's CLOSE-direction
// width/marginRight collapse delays by roughly this long (rule 4,
// criterion-item.tsx's staged-exit pattern: fade first, then collapse the
// now-invisible box) so the panel does not visibly retract text mid-fade.
// Opening carries no such delay on the box itself: it widens immediately and
// the content fades in after (see the inner motion.div's own enter delay).
const CONTENT_FADE_OUT = 0.1

// Variants (not a single inline `animate` object) so the CLOSE direction can
// carry its own delayed transition without affecting the OPEN direction,
// same reasoning as criterion-item.tsx's rowVariants.
const railVariants: Variants = {
  open: {
    width: RAIL_WIDTH,
    marginRight: RAIL_GAP,
    transition: SPRING,
  },
  closed: {
    width: 0,
    marginRight: 0,
    transition: { ...SPRING, delay: CONTENT_FADE_OUT },
  },
}

// The chat header's history trigger opens this rail: an inline slide-out at
// the boundary between the page content and the app sidebar, width 0 <->
// RAIL_WIDTH, `open`/`busy` owned by the
// page (app/(app)/assistant/page.tsx) so the toggle button and this panel
// can never disagree on state. The page keeps this rail on a full-width row
// (no reading-width cap of its own) precisely so this left edge is the real
// page-content/sidebar boundary, not merely the chat column's own edge.
//
// Split per docs/ui-animation.md #2 (height/width vs the CSS box model): the
// OUTER motion.div carries ONLY animated geometry (width, marginRight) and no
// visual box styles, so `width: 0` truly means zero; the INNER div carries the
// fixed width (so text never rewraps mid-slide, same reasoning as
// MorphPopover's fixed content width), the padding, and the
// flex-col + min-h-0 + overflow-y-auto chain that lets the thread list scroll
// on its own without the bounded row ever growing taller than intended
// (docs/ui-animation.md's box-model warning applies to a flex item's default
// min-height:auto too: without min-h-0 here, a long list could force this
// rail, and the row it sits in, to grow past the page's locked height).
//
// The list itself mounts only while open (AnimatePresence, a fast fade per
// rule 4's staged-exit guidance) so a closed rail carries no thread rows in
// the tree at all, not merely a clipped one.
//
// Selecting a thread keeps the rail open (the caller is browsing); only the
// header's toggle button closes it. Each row disables while `busy` (switching
// mid-stream would silently orphan the in-flight reply, the same orphan guard
// New conversation and the header toggle use), and the active thread (status
// "active", at most one) is marked rather than clickable.
export function AssistantHistoryRail({
  open,
  busy,
}: {
  open: boolean
  busy: boolean
}) {
  const t = useTranslations("dashboard.assistant")

  return (
    <motion.div
      initial={false}
      variants={railVariants}
      animate={open ? "open" : "closed"}
      className="min-h-0 shrink-0 overflow-hidden"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            key="rail-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.08 } }}
            exit={{ opacity: 0, transition: { duration: CONTENT_FADE_OUT } }}
            className="flex h-full min-h-0 flex-col"
            style={{ width: RAIL_WIDTH }}
          >
            <div className="flex h-10 shrink-0 items-center px-3 font-medium text-muted-foreground text-xs">
              {t("history")}
            </div>
            <AssistantHistoryThreadList busy={busy} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Split out from AssistantHistoryRail so useAssistantThreads' subscription
// lives on THIS node's own mount lifetime: it mounts only while the
// AnimatePresence child above is present (open, or mid-close-fade), never
// for the outer rail's own lifetime, which the page mounts unconditionally
// on every /assistant visit.
function AssistantHistoryThreadList({ busy }: { busy: boolean }) {
  const t = useTranslations("dashboard.assistant")
  const tToast = useTranslations("dashboard.toast")
  const format = useFormatter()
  const { orgId } = useOrganization()
  const { threads, loading } = useAssistantThreads(orgId)
  const switchConversation = useMutation(api.assistant.chat.switchConversation)

  async function handleSwitch(threadId: Id<"assistantThreads">) {
    try {
      await switchConversation({ orgId, threadId })
    } catch {
      toast.error(tToast("error"))
    }
  }

  if (loading) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <div className="flex flex-col gap-1">
          {HISTORY_SKELETON_ROW_KEYS.map((key) => (
            <div
              key={key}
              className="flex w-full flex-col items-start gap-0.5 px-2 py-2"
            >
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
      <div className="flex flex-col gap-1">
        {threads.map((thread) => {
          const isActive = thread.status === "active"
          return (
            <Button
              key={thread._id}
              type="button"
              variant="ghost"
              disabled={isActive || busy}
              aria-current={isActive ? "true" : undefined}
              className="h-auto w-full flex-col items-start gap-0.5 whitespace-normal px-2 py-2 text-left"
              onClick={() => void handleSwitch(thread._id)}
            >
              <span className="flex w-full items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {thread.title ?? t("untitled")}
                </span>
                {isActive && (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    strokeWidth={2}
                    className="size-4 shrink-0"
                  />
                )}
              </span>
              <span className="w-full truncate text-muted-foreground text-xs">
                {format.dateTime(new Date(thread.lastMessageAt), {
                  dateStyle: "medium",
                })}
              </span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
