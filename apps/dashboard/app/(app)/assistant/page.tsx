"use client"

import { PlusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { AssistantPanel } from "@/components/assistant/assistant-panel"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { useAssistantChat } from "@/hooks/use-assistant-chat"
import { usePageTitle } from "@/hooks/use-page-title"
import { toast } from "@/lib/toast"

export default function AssistantPage() {
  const t = useTranslations("dashboard.assistant")
  const tHelp = useTranslations("dashboard.help")
  const tToast = useTranslations("dashboard.toast")
  usePageTitle(t("title"))
  const { orgId } = useOrganization()
  const newConversation = useMutation(api.assistant.chat.newConversation)
  // The same hook AssistantPanel reads: Convex dedupes the identical
  // subscriptions, so this costs nothing extra, and disabling the New
  // conversation button while a reply streams (archiving the active thread
  // mid-stream would silently orphan it) can never lag the panel by a
  // render, unlike a state mirror fed through an effect would.
  const { busy } = useAssistantChat(orgId)

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
      <div className="flex items-center justify-end gap-2">
        <HelpMorphButton label={t("title")}>
          {tHelp("assistantBody")}
        </HelpMorphButton>
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
      <AssistantPanel />
    </div>
  )
}
