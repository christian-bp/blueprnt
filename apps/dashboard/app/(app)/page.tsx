"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useOrganization } from "@/components/org-context"

// Start page: real derived counts, no stored aggregates. Each card links to
// its section. Numbers here are counts, never scores or weights.
export default function OverviewPage() {
  const t = useTranslations("dashboard.overview")
  const { orgId } = useOrganization()
  const locale = useLocale()
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })

  const loading = roles === undefined || model === undefined
  const approved = roles?.filter((role) => role.status === "approved") ?? []
  const rated =
    roles?.filter(
      (role) => role.totalCriteria > 0 && role.ratedCount === role.totalCriteria
    ) ?? []

  const cards = [
    {
      key: "roles",
      label: t("rolesCard"),
      value: roles?.length ?? 0,
      href: "/roles",
      linkLabel: t("goRoles"),
    },
    {
      key: "approved",
      label: t("approvedCard"),
      value: approved.length,
      href: "/results",
      linkLabel: t("goResults"),
    },
    {
      key: "rated",
      label: t("ratedCard"),
      value: rated.length,
      href: "/results",
      linkLabel: t("goResults"),
    },
    {
      key: "criteria",
      label: t("criteriaCard"),
      value: model?.criteria.length ?? 0,
      href: "/model",
      linkLabel: t("goModel"),
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.key}>
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {loading ? <Skeleton className="h-9 w-12" /> : card.value}
            </CardTitle>
            <Link
              href={card.href}
              className="text-muted-foreground text-sm underline-offset-4 hover:underline"
            >
              {card.linkLabel}
            </Link>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
