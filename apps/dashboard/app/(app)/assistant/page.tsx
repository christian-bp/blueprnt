"use client"

import { SidebarLeftIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { AssistantHistoryPanel } from "@/components/assistant/assistant-history"
import { AssistantPanel } from "@/components/assistant/assistant-panel"
import { AssistantTitle } from "@/components/assistant/assistant-title"
import { useOrganization } from "@/components/org-context"
import { useAssistantChat } from "@/hooks/use-assistant-chat"
import { usePageTitle } from "@/hooks/use-page-title"
import {
  initialAssistantHistoryOpen,
  persistAssistantHistoryOpen,
} from "@/lib/assistant-history-state"
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
  // the centered AssistantTitle; AssistantHistoryPanel reads its own thread
  // list via useAssistantThreads, a deliberately separate subscription so
  // this hook (read by every chat render) never pays for the full history.
  const { busy, title } = useAssistantChat(orgId)
  // Persisted across visits the same way the app sidebar's own open state is
  // (lib/assistant-history-state.ts, one shared cookie idiom); no stored
  // choice defaults to open, since the panel is the default view.
  const [panelOpen, setPanelOpen] = useState(initialAssistantHistoryOpen)

  const handleNewConversation = async () => {
    try {
      await newConversation({ orgId })
    } catch {
      toast.error(tToast("error"))
    }
  }

  function togglePanel(next: boolean) {
    setPanelOpen(next)
    persistAssistantHistoryOpen(next)
  }

  return (
    // AppShell locks SidebarInset's own height to the viewport for this route
    // (app-shell.tsx: assistantBounded) and propagates min-h-0/flex-1 down to
    // here, so this wrapper only needs to fill that bounded height, never
    // define one of its own: min-h-0 (a floor would let the row grow past
    // the viewport) lets it shrink to fit, and overflow-hidden is a second
    // line of defense so nothing inside can force a page-level scrollbar.
    // A column, deliberately FULL WIDTH (no mx-auto/max-w here): both this
    // header and the panel below it have to reach the real boundary between
    // the page content and the app sidebar, which only works if nothing
    // narrower sits between them and that edge. The column is bounded only
    // by the shell's own page cap (app-shell.tsx: PAGE_MAX_W), which is also
    // what centers the reading column beneath it, so the two share the same
    // midpoint regardless of the panel's width.
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
      {/* Header spans the full page width, outside the reading-width cap:
          only the animated title lives here now (the history toggle and New
          conversation both moved into the panel below). The two flex-1
          spacers stay so the title keeps animating its own width from 0 to
          auto without shifting either edge of the row; without them the
          title, as the row's only child, would not be centered at all. */}
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex flex-1 justify-start" />
        <AssistantTitle title={title} />
        <div className="flex flex-1 justify-end" />
      </div>
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        <AssistantHistoryPanel
          open={panelOpen}
          busy={busy}
          onCollapse={() => togglePanel(false)}
          onNewConversation={() => void handleNewConversation()}
        />
        {/* relative: anchors the expand button that appears here, at the far
            left of the content area, while the panel is collapsed (where the
            history toggle used to sit). */}
        <div className="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden">
          {!panelOpen && (
            <div className="absolute top-2 left-2 z-10">
              {/* Never busy-gated, same as the panel's own collapse button:
                  expanding the panel touches no thread. */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("history")}
                onClick={() => togglePanel(true)}
              >
                <HugeiconsIcon
                  icon={SidebarLeftIcon}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </Button>
            </div>
          )}
          <AssistantPanel />
        </div>
      </div>
    </div>
  )
}
