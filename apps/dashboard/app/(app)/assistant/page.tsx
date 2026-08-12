"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { AssistantPanel } from "@/components/assistant/assistant-panel"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AssistantPage() {
  const t = useTranslations("dashboard.assistant")
  const tHelp = useTranslations("dashboard.help")
  usePageTitle(t("title"))
  const { orgId } = useOrganization()
  const newConversation = useMutation(api.assistant.chat.newConversation)
  // Lifted out of AssistantPanel (the data owner) so the New conversation
  // button can live in the page header action slot per house convention,
  // while still disabling itself while a reply is streaming: archiving the
  // active thread mid-stream would silently orphan that reply.
  const [busy, setBusy] = useState(false)

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
      <AssistantPanel onBusyChange={setBusy} />
    </div>
  )
}
