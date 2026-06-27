"use client"

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useTranslations } from "next-intl"
import { AvatarUpload } from "./avatar-upload"

// Profile picture section card for the account settings profile tab.
// Composes the AvatarUpload control inside a standard shadcn Card layout
// following the pattern used in the polyform reference (user-avatar.tsx).
export function AvatarSection() {
  const t = useTranslations("dashboard.account.profile.avatar")

  return (
    <Card>
      <div className="flex items-start justify-between gap-8">
        <CardHeader className="flex-1">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <div className="pt-6 pr-6">
          <AvatarUpload />
        </div>
      </div>
      <CardFooter className="text-muted-foreground text-sm">
        {t("helper")}
      </CardFooter>
    </Card>
  )
}
