"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { PAGE_PADDING } from "@/components/app-shell"
import { AssistantHistoryPanel } from "@/components/assistant/assistant-history"
import { AssistantPanel } from "@/components/assistant/assistant-panel"
import { AssistantTitle } from "@/components/assistant/assistant-title"
import { InnerSidebarHandle } from "@/components/inner-sidebar-handle"
import { useOrganization } from "@/components/org-context"
import { useAssistantChat } from "@/hooks/use-assistant-chat"
import { usePageTitle } from "@/hooks/use-page-title"
import {
  ASSISTANT_HISTORY_COOKIE,
  initialInnerSidebarOpen,
  persistInnerSidebarOpen,
} from "@/lib/inner-sidebar-state"
import { toast } from "@/lib/toast"

export default function AssistantPage() {
  const t = useTranslations("dashboard.assistant")
  const tShell = useTranslations("dashboard.shell")
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
  // (lib/inner-sidebar-state.ts, one shared cookie idiom); no stored choice
  // defaults to open, since the panel is the default view.
  const [panelOpen, setPanelOpen] = useState(() =>
    initialInnerSidebarOpen(ASSISTANT_HISTORY_COOKIE)
  )

  const handleNewConversation = async () => {
    try {
      await newConversation({ orgId })
    } catch {
      toast.error(tToast("error"))
    }
  }

  function togglePanel(next: boolean) {
    setPanelOpen(next)
    persistInnerSidebarOpen(ASSISTANT_HISTORY_COOKIE, next)
  }

  return (
    // AppShell locks SidebarInset's own height to the viewport for this route
    // (app-shell.tsx: assistantBounded) and propagates min-h-0/flex-1 down to
    // here, so this wrapper only needs to fill that bounded height, never
    // define one of its own: min-h-0 (a floor would let the row grow past
    // the viewport) lets it shrink to fit, and overflow-hidden is a second
    // line of defense so nothing inside can force a page-level scrollbar.
    // A row, deliberately FULL WIDTH: the shell leaves this route uncapped
    // (app-shell.tsx: assistantBounded skips PAGE_MAX_W) precisely so the
    // panel's left edge reaches the real boundary between the page content
    // and the app sidebar, with nothing narrower in between. The chat side
    // centers its own reading column in whatever width remains beside the
    // panel, so the header title always sits over the CHAT, not over the
    // page as a whole.
    <div className="flex min-h-0 w-full flex-1 overflow-hidden">
      <AssistantHistoryPanel
        open={panelOpen}
        busy={busy}
        onNewConversation={() => void handleNewConversation()}
      />
      {/* relative: anchors the expand button that appears at this column's
          top-left while the panel is collapsed. PAGE_PADDING is the shell's
          own page inset, which this route does not receive (app-shell.tsx:
          hasInnerSidebar) so the panel beside this column stays flush; the
          chat side keeps it. */}
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col gap-4 overflow-hidden",
          PAGE_PADDING
        )}
      >
        {/* The collapse control stands at the seam between the panel and this
            column (this column's left edge IS that seam at every animation
            frame, so the handle needs no position syncing). Never busy-gated:
            collapsing or expanding touches no thread. */}
        <InnerSidebarHandle
          open={panelOpen}
          onToggle={() => togglePanel(!panelOpen)}
          collapseLabel={tShell("collapseNav")}
          expandLabel={tShell("expandNav")}
        />
        {/* Only the animated title lives in the header. The two flex-1
            spacers stay so the title animates its own width from 0 to auto
            without shifting either edge of the row; without them the title,
            as the row's only child, would not be centered at all. */}
        <div className="flex shrink-0 items-center justify-between">
          <div className="flex flex-1 justify-start" />
          <AssistantTitle title={title} />
          <div className="flex flex-1 justify-end" />
        </div>
        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden">
          <AssistantPanel />
        </div>
      </div>
    </div>
  )
}
