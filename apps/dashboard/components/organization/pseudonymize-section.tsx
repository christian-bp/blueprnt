"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useOrganization } from "@/components/org-context"

// Org display toggle: when on, the UI substitutes a reference number for
// the stored displayName (pure client-side formatting via lib/person-display;
// the stored name is unchanged). Saved immediately on toggle: a single
// non-destructive boolean has nothing to gate on.
export function PseudonymizeSection({
  pseudonymizeNames,
}: {
  pseudonymizeNames: boolean
}) {
  const t = useTranslations("dashboard.organization.general")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const updateSettings = useMutation(
    api.accounts.organization.updateOrganizationSettings
  )

  async function onToggle(next: boolean) {
    await updateSettings({ orgId, pseudonymizeNames: next })
    toast.success(tToast("orgSaved"))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pseudonymizeLabel")}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <Label
          htmlFor="pseudonymize-toggle"
          className="font-normal text-muted-foreground text-sm"
        >
          {t("pseudonymizeDescription")}
        </Label>
        <Switch
          id="pseudonymize-toggle"
          defaultChecked={pseudonymizeNames}
          onCheckedChange={onToggle}
        />
      </CardContent>
    </Card>
  )
}
