"use client"

import {
  ArrowLeft01Icon,
  MoreVerticalIcon,
  PlusSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useMutation } from "convex/react"
import { AnimatePresence, motion } from "motion/react"
import type { Variants } from "motion/react"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { useOrganization } from "@/components/org-context"
import { RenameConversationDialog } from "@/components/assistant/rename-conversation-dialog"
import { useAssistantThreads } from "@/hooks/use-assistant-threads"
import { SPRING } from "@/lib/motion"
import { relativeDayBucket } from "@/lib/relative-day"
import { toast } from "@/lib/toast"

// The panel's open width and the gap it carries to the main column, both
// carried by the panel's OWN animated geometry rather than a flex `gap` on
// the row: a container gap does not collapse with a shrinking flex item
// (docs/ui-animation.md #3), so a `gap-*` on the row would still reserve
// dead space once the panel's width reached 0. Animating both together means
// closed truly means zero footprint, no gap artifact left behind.
const PANEL_WIDTH = 280
const PANEL_GAP = 16

// Row count for the loading skeleton, not the list's own page size: the list
// is unpaginated and never grows past ASSISTANT_THREAD_LIST_LIMIT, so this
// is purely how many placeholder rows read as "a list" without overfilling
// the panel before real data arrives.
const HISTORY_SKELETON_ROW_KEYS = ["s1", "s2", "s3"] as const

// The content's own exit-fade duration. The panel's CLOSE-direction
// width/marginRight collapse delays by roughly this long (rule 4,
// criterion-item.tsx's staged-exit pattern: fade first, then collapse the
// now-invisible box) so the panel does not visibly retract text mid-fade.
// Opening carries no such delay on the box itself: it widens immediately and
// the content fades in after (see the inner motion.div's own enter delay).
const CONTENT_FADE_OUT = 0.1

// Variants (not a single inline `animate` object) so the CLOSE direction can
// carry its own delayed transition without affecting the OPEN direction,
// same reasoning as criterion-item.tsx's rowVariants.
const panelVariants: Variants = {
  open: {
    width: PANEL_WIDTH,
    marginRight: PANEL_GAP,
    transition: SPRING,
  },
  closed: {
    width: 0,
    marginRight: 0,
    transition: { ...SPRING, delay: CONTENT_FADE_OUT },
  },
}

// The assistant's persistent conversations panel: open by default, listing
// every conversation with a "New conversation" button and a collapse control
// at its own top, at the boundary between the page content and the app
// sidebar. `open`/`busy` are owned by the page (app/(app)/assistant/page.tsx)
// so this panel, its own collapse button, and the expand button the page
// renders in the main column while collapsed can never disagree on state.
// Width 0 <-> PANEL_WIDTH, same slide animation as the rail this replaced.
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
// panel, and the row it sits in, to grow past the page's locked height).
//
// The list itself mounts only while open (AnimatePresence, a fast fade per
// rule 4's staged-exit guidance) so a closed panel carries no thread rows in
// the tree at all, not merely a clipped one.
//
// Selecting a thread keeps the panel open (the caller is browsing); only the
// header's collapse button closes it. Each row disables while `busy`
// (switching mid-stream would silently orphan the in-flight reply, the same
// orphan guard New conversation and the collapse toggle use), and the active
// thread (status "active", at most one) is marked rather than clickable.
export function AssistantHistoryPanel({
  open,
  busy,
  onCollapse,
  onNewConversation,
}: {
  open: boolean
  busy: boolean
  onCollapse: () => void
  onNewConversation: () => void
}) {
  const t = useTranslations("dashboard.assistant")

  return (
    <motion.div
      initial={false}
      variants={panelVariants}
      animate={open ? "open" : "closed"}
      className="min-h-0 shrink-0 overflow-hidden"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.08 } }}
            exit={{ opacity: 0, transition: { duration: CONTENT_FADE_OUT } }}
            className="flex h-full min-h-0 flex-col"
            style={{ width: PANEL_WIDTH }}
          >
            <div className="flex h-10 shrink-0 items-center justify-between gap-1 px-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onNewConversation}
              >
                <HugeiconsIcon
                  icon={PlusSignIcon}
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                {t("newConversation")}
              </Button>
              {/* Never busy-gated, unlike the rows and New conversation
                  above: collapsing the panel touches no thread, so it carries
                  none of the orphan hazard that gates them. */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("history")}
                onClick={onCollapse}
              >
                {/* The app's standard chevron glyph, pointing the way the
                    panel folds; the history glyph belongs to the collapsed
                    state's expand button, where it names what comes back. */}
                <HugeiconsIcon
                  icon={ArrowLeft01Icon}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </Button>
            </div>
            <AssistantHistoryThreadList busy={busy} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Split out from AssistantHistoryPanel so useAssistantThreads' subscription
// lives on THIS node's own mount lifetime: it mounts only while the
// AnimatePresence child above is present (open, or mid-close-fade), never
// for the outer panel's own lifetime, which the page mounts unconditionally
// on every /assistant visit.
function AssistantHistoryThreadList({ busy }: { busy: boolean }) {
  const { orgId } = useOrganization()
  const { threads, loading } = useAssistantThreads(orgId)

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
        {threads.map((thread) => (
          <AssistantHistoryThreadRow
            key={thread._id}
            thread={thread}
            busy={busy}
          />
        ))}
      </div>
    </div>
  )
}

// One panel row: the switch-conversation control plus its trailing row-actions
// menu, in a plain div rather than a single wrapping Button (a button cannot
// contain a button). The menu trigger sits in an always-rendered, fixed-size
// slot next to the switch control, so its presence never reflows the title
// truncation beside it.
function AssistantHistoryThreadRow({
  thread,
  busy,
}: {
  thread: {
    _id: Id<"assistantThreads">
    title?: string
    status: "active" | "archived"
    lastMessageAt: number
  }
  busy: boolean
}) {
  const t = useTranslations("dashboard.assistant")
  const tToast = useTranslations("dashboard.toast")
  const format = useFormatter()
  const { orgId } = useOrganization()
  const switchConversation = useMutation(api.assistant.chat.switchConversation)
  const deleteConversation = useMutation(api.assistant.chat.deleteConversation)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const isActive = thread.status === "active"
  // `now` is read once per render, not on a timer: the label can go stale
  // (still reading "Today" a few seconds into the next day) until the next
  // render, which is acceptable for a conversations panel that re-renders
  // often (any switch, rename, or delete) and never worth a dedicated timer.
  const dateBucket = relativeDayBucket(
    new Date(thread.lastMessageAt),
    new Date()
  )
  const dateLabel =
    dateBucket === "today"
      ? t("dateToday")
      : dateBucket === "yesterday"
        ? t("dateYesterday")
        : format.dateTime(new Date(thread.lastMessageAt), {
            dateStyle: "medium",
          })

  async function handleSwitch() {
    try {
      await switchConversation({ orgId, threadId: thread._id })
    } catch {
      toast.error(tToast("error"))
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        disabled={isActive || busy}
        aria-current={isActive ? "true" : undefined}
        className="h-auto min-w-0 flex-1 flex-col items-start gap-0.5 whitespace-normal px-2 py-2 text-left"
        onClick={() => void handleSwitch()}
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
          {dateLabel}
        </span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={busy}
              aria-label={t("rowActionsLabel", {
                title: thread.title ?? t("untitled"),
              })}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            />
          }
        >
          <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            {t("renameConversation")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            {t("deleteConversation")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameConversationDialog
        orgId={orgId}
        threadId={thread._id}
        currentTitle={thread.title ?? ""}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />
      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("deleteConversationTitle")}
        description={t("deleteConversationDescription")}
        confirmLabel={t("deleteConversationConfirm")}
        cancelLabel={t("deleteConversationCancel")}
        pending={deleting}
        onConfirm={async () => {
          setDeleting(true)
          try {
            await deleteConversation({ orgId, threadId: thread._id })
            toast.success(tToast("conversationDeleted"))
          } catch (error) {
            toast.error(tToast("error"))
            throw error
          } finally {
            setDeleting(false)
          }
        }}
      />
    </div>
  )
}
