"use client"

import { PlusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { AssistantHistory } from "@/components/assistant/assistant-history"
import { AssistantPanel } from "@/components/assistant/assistant-panel"
import { AssistantTitle } from "@/components/assistant/assistant-title"
import { useOrganization } from "@/components/org-context"
import { useAssistantChat } from "@/hooks/use-assistant-chat"
import { usePageTitle } from "@/hooks/use-page-title"
import { toast } from "@/lib/toast"

export default function AssistantPage() {
  const t = useTranslations("dashboard.assistant")
  const tToast = useTranslations("dashboard.toast")
  usePageTitle(t("title"))
  const { orgId } = useOrganization()
  const newConversation = useMutation(api.assistant.chat.newConversation)
  // The same hook AssistantPanel reads: Convex dedupes the identical
  // subscriptions, so this costs nothing extra, and disabling the New
  // conversation button while a reply streams (archiving the active thread
  // mid-stream would silently orphan it) can never lag the panel by a
  // render, unlike a state mirror fed through an effect would. `title` feeds
  // the centered AssistantTitle; AssistantHistory reads its own thread list
  // via useAssistantThreads, a deliberately separate subscription so this
  // hook (read by every chat render) never pays for the full history.
  const { busy, title } = useAssistantChat(orgId)

  const handleNewConversation = async () => {
    try {
      await newConversation({ orgId })
    } catch {
      toast.error(tToast("error"))
    }
  }

  return (
    // AppShell locks SidebarInset's own height to the viewport for this route
    // (app-shell.tsx: assistantBounded) and propagates min-h-0/flex-1 down to
    // here, so this wrapper only needs to fill that bounded height, never
    // define one of its own: min-h-0 (a floor would let the column grow past
    // the viewport) lets it shrink to fit, and overflow-hidden is a second
    // line of defense so nothing inside can force a page-level scrollbar.
    // MessageScrollerViewport (inside AssistantPanel) stays the only element
    // that actually scrolls, and the composer below it never moves,
    // regardless of thread length.
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 overflow-hidden">
      {/* Three regions: history left, the animated title centered, New
          conversation right. The outer flex-1 wrappers (not the title
          itself) hold the left/right controls pinned to their edges, so the
          title animating its own width from 0 to auto on arrival never
          shifts either button; only the leftover space between them
          changes. */}
      <div className="flex items-center justify-between">
        <div className="flex flex-1 justify-start">
          <AssistantHistory busy={busy} />
        </div>
        <AssistantTitle title={title} />
        <div className="flex flex-1 justify-end">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void handleNewConversation()}
          >
            <HugeiconsIcon
              icon={PlusSignIcon}
              size={16}
              strokeWidth={2}
              aria-hidden="true"
            />
            {t("newConversation")}
          </Button>
        </div>
      </div>
      <AssistantPanel />
    </div>
  )
}
