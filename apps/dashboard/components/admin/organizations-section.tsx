"use client"

import { MoreVerticalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { CreateOrganizationDialog } from "@/components/admin/create-organization-dialog"
import { ManageOrganizationDialog } from "@/components/admin/manage-organization-dialog"
import { CountryDisplay } from "@/components/country-display"

export function OrganizationsSection() {
  const t = useTranslations("dashboard.admin.orgs")
  const orgs = useQuery(api.platform.admin.listOrganizations, {})
  const [query, setQuery] = useState("")
  const [manageOrgId, setManageOrgId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (orgs === undefined) return []
    if (q === "") return orgs
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q)
    )
  }, [orgs, query])

  const manageOrg = (orgs ?? []).find((o) => o.orgId === manageOrgId) ?? null

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium text-lg">{t("heading")}</h2>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <CreateOrganizationDialog />
      </div>
      <Input
        value={query}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        onChange={(event) => setQuery(event.target.value)}
        className="w-72"
      />
      {orgs !== undefined && filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.slug")}</TableHead>
              <TableHead>{t("table.country")}</TableHead>
              <TableHead>{t("table.onboarded")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((org) => (
              <TableRow key={org.orgId}>
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {org.slug}
                </TableCell>
                <TableCell>
                  <CountryDisplay code={org.country} />
                </TableCell>
                <TableCell>
                  <Badge variant={org.onboarded ? "secondary" : "outline"}>
                    {org.onboarded ? t("onboardedYes") : t("onboardedNo")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("rowActions", { name: org.name })}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <HugeiconsIcon
                            icon={MoreVerticalIcon}
                            strokeWidth={2}
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => setManageOrgId(org.orgId)}
                        >
                          {t("manageCta")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {manageOrg !== null && (
        <ManageOrganizationDialog
          org={manageOrg}
          open={manageOrgId !== null}
          onOpenChange={(next) => {
            if (!next) setManageOrgId(null)
          }}
        />
      )}
    </section>
  )
}
