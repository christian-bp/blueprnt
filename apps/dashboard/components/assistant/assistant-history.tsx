"use client"

import { HistoryIcon, Tick02Icon } from "@hugeicons/core-free-icons"
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
import { useMutation } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { useOrganization } from "@/components/org-context"
import { useAssistantThreads } from "@/hooks/use-assistant-threads"
import { toast } from "@/lib/toast"

// The chat header's history trigger: a ghost icon button opening a
// DropdownMenu of the caller's own conversations (useAssistantThreads, most
// recently active first). Each row shows its AI-generated title, or a
// localized "untitled" fallback, with its last-activity date; the currently
// active thread (status "active", there is at most one) is checked rather
// than clickable, so revisiting the conversation you are already in never
// fires a redundant mutation (DropdownMenuItem's own `disabled` blocks the
// click at the source, same as any other disabled control here). The
// trigger disables while busy, the same orphan guard New conversation uses
// (app/(app)/assistant/page.tsx): switching away mid-stream would silently
// orphan the in-flight reply.
export function AssistantHistory({ busy }: { busy: boolean }) {
  const t = useTranslations("dashboard.assistant")
  const tToast = useTranslations("dashboard.toast")
  const format = useFormatter()
  const { orgId } = useOrganization()
  const { threads } = useAssistantThreads(orgId)
  const switchConversation = useMutation(api.assistant.chat.switchConversation)

  async function handleSwitch(threadId: Id<"assistantThreads">) {
    try {
      await switchConversation({ orgId, threadId })
    } catch {
      toast.error(tToast("error"))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label={t("history")}
          />
        }
      >
        <HugeiconsIcon icon={HistoryIcon} strokeWidth={2} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {threads.map((thread) => {
          const isActive = thread.status === "active"
          return (
            <DropdownMenuItem
              key={thread._id}
              disabled={isActive}
              aria-current={isActive ? "true" : undefined}
              className="gap-2"
              onClick={() => void handleSwitch(thread._id)}
            >
              <span className="min-w-0 flex-1 truncate">
                {thread.title ?? t("untitled")}
              </span>
              <span className="shrink-0 text-muted-foreground text-xs">
                {format.dateTime(new Date(thread.lastMessageAt), {
                  dateStyle: "medium",
                })}
              </span>
              {isActive && (
                <HugeiconsIcon
                  icon={Tick02Icon}
                  strokeWidth={2}
                  className="size-4 shrink-0"
                />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
