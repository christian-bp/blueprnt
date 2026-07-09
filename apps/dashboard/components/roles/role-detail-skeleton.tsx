"use client"

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"
import { PageBreadcrumb } from "@/components/page-breadcrumb"
import { PageHeader } from "@/components/page-header"

// Content-shaped loading state for the role page: the real layout (header,
// profile card, evaluation rail) with the static chrome rendered for real
// (card titles and field labels are i18n text, not data) and skeleton bars
// standing in only for the role's own values, so the structure appears
// instantly and nothing reflows when the data arrives.

// A read-view field: its real label over a value bar centered in the value
// text's line box (text-sm line height), the same centering trick as
// TableSkeleton so the loaded value does not shift the layout.
function FieldSkeleton({ label, bar }: { label: string; bar: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-muted-foreground">{label}</Label>
      <div className="flex min-h-5 items-center">
        <Skeleton className={`h-4 ${bar}`} />
      </div>
    </div>
  )
}

export function RoleDetailSkeleton() {
  const t = useTranslations("dashboard.roles.detail")
  const tNav = useTranslations("dashboard.nav")
  const tRole = useTranslations("assessment.role")
  const tModel = useTranslations("model")

  return (
    <div className="space-y-6">
      <PageHeader
        // The Roles crumb is static; the family/title crumbs join it with
        // the data.
        breadcrumb={
          <PageBreadcrumb
            segments={[{ label: tNav("roles"), href: "/roles" }]}
          />
        }
        title={<Skeleton className="h-7 w-56 max-w-full" />}
        titleAdornment={<Skeleton className="h-5 w-20 rounded-full" />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("profileHeading")}</CardTitle>
              {/* The real actions trigger (static chrome, enabled no-op:
                  the load is brief and disabling would just flash gray). */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("manageCta")}
                className="shrink-0"
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <FieldSkeleton label={tRole("title")} bar="w-32 max-w-full" />
                <FieldSkeleton
                  label={tRole("function")}
                  bar="w-24 max-w-full"
                />
                <FieldSkeleton label={tRole("team")} bar="w-20 max-w-full" />
              </div>
              <FieldSkeleton label={tModel("roleFamily")} bar="w-36" />
              <div className="space-y-1">
                <Label className="text-muted-foreground">
                  {tRole("purpose")}
                </Label>
                <div className="space-y-2 pt-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">
                  {tRole("responsibilities")}
                </Label>
                <div className="space-y-2 pt-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>{t("evaluationHeading")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-9 w-32 rounded-md" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
