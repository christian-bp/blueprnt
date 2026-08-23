"use client"

import {
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { useMutation } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { InnerSidebar } from "@/components/inner-sidebar"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { useOrganization } from "@/components/org-context"
import { RenameConversationDialog } from "@/components/assistant/rename-conversation-dialog"
import { useAssistantThreads } from "@/hooks/use-assistant-threads"
import { relativeDayBucket } from "@/lib/relative-day"
import { toast } from "@/lib/toast"

// Row count for the loading skeleton, not the list's own page size: the list
// is unpaginated and never grows past ASSISTANT_THREAD_LIST_LIMIT, so this
// is purely how many placeholder rows read as "a list" without overfilling
// the panel before real data arrives.
const HISTORY_SKELETON_ROW_KEYS = ["s1", "s2", "s3"] as const

// The assistant's persistent conversations panel: open by default, listing
// every conversation with a "New conversation" button. `open`/`busy` are owned
// by the page (app/(app)/assistant/page.tsx) so this panel, its collapse
// control, and the expand button the page renders while collapsed can never
// disagree on state.
//
// The frame, its collapse animation and its border come from InnerSidebar; the
// only thing this file adds is the surface's own header action and its thread
// list.
export function AssistantHistoryPanel({
  open,
  busy,
  onNewConversation,
}: {
  open: boolean
  busy: boolean
  onNewConversation: () => void
}) {
  const t = useTranslations("dashboard.assistant")

  return (
    <InnerSidebar
      open={open}
      label={t("history")}
      // The route is height-locked by AppShell, so the sidebar fills it.
      height="fill"
      // Below md the chat needs the whole pane; the conversation list has no
      // mobile surface yet, matching the shell's own inner sidebar.
      className="hidden md:flex"
      // The same header anatomy as a registry nav group: the uppercase panel
      // label on the left, the panel's one action as a plain icon in the top
      // right corner.
      actions={
        <>
          <p className="px-1 font-medium text-[11px] text-foreground/70 uppercase">
            {t("history")}
          </p>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  aria-label={t("newConversation")}
                  onClick={onNewConversation}
                />
              }
            >
              <HugeiconsIcon
                icon={PlusSignIcon}
                strokeWidth={2}
                aria-hidden="true"
              />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("newConversation")}
            </TooltipContent>
          </Tooltip>
        </>
      }
    >
      <div className="px-2">
        <AssistantHistoryThreadList busy={busy} />
      </div>
    </InnerSidebar>
  )
}

// Split out from AssistantHistoryPanel so useAssistantThreads' subscription
// lives on THIS node's own mount lifetime: it mounts only while the
// primitive's own content region is present (open, or mid-close-fade), never
// for the outer panel's own lifetime, which the page mounts unconditionally
// on every /assistant visit.
function AssistantHistoryThreadList({ busy }: { busy: boolean }) {
  const { orgId } = useOrganization()
  const { threads, loading } = useAssistantThreads(orgId)

  if (loading) {
    return (
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
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {threads.map((thread) => (
        <AssistantHistoryThreadRow
          key={thread._id}
          thread={thread}
          busy={busy}
        />
      ))}
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
  // Every bucket keeps the clock time beside the day label ("Today 14:32",
  // "12 Aug 2026 09:15"): the day word alone cannot separate two
  // conversations from the same day.
  const timeLabel = format.dateTime(new Date(thread.lastMessageAt), {
    timeStyle: "short",
  })
  const dayLabel =
    dateBucket === "today"
      ? t("dateToday")
      : dateBucket === "yesterday"
        ? t("dateYesterday")
        : format.dateTime(new Date(thread.lastMessageAt), {
            dateStyle: "medium",
          })
  const dateLabel = `${dayLabel} ${timeLabel}`

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
