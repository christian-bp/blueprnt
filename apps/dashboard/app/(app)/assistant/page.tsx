"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { AssistantPanel } from "@/components/assistant/assistant-panel"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { useAssistantChat } from "@/hooks/use-assistant-chat"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AssistantPage() {
  const t = useTranslations("dashboard.assistant")
  const tHelp = useTranslations("dashboard.help")
  usePageTitle(t("title"))
  const { orgId } = useOrganization()
  const newConversation = useMutation(api.assistant.chat.newConversation)
  // The same hook AssistantPanel reads: Convex dedupes the identical
  // subscriptions, so this costs nothing extra, and disabling the New
  // conversation button while a reply streams (archiving the active thread
  // mid-stream would silently orphan it) can never lag the panel by a
  // render, unlike a state mirror fed through an effect would.
  const { busy } = useAssistantChat(orgId)

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl flex-col gap-4">
      <PageHeader
        title={t("title")}
        titleAdornment={
          <HelpMorphButton label={t("title")}>
            {tHelp("assistantBody")}
          </HelpMorphButton>
        }
        action={
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void newConversation({ orgId })}
          >
            {t("newConversation")}
          </Button>
        }
      />
      <AssistantPanel />
    </div>
  )
}
