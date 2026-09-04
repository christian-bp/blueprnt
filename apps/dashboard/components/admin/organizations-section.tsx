"use client"

import { Medallion } from "@/components/medallion"
import { Building01Icon, MoreVerticalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
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
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
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
import { TableSearchField } from "@/components/table-search-field"
import { FrameTable } from "@/components/frame-table"
import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"
import { initialsOf } from "@/lib/initials"
import { ActionsMenuTrigger } from "@/components/actions-menu-trigger"

export function OrganizationsSection() {
  const t = useTranslations("dashboard.admin.orgs")
  const tTabs = useTranslations("dashboard.admin.tabs")
  const tNav = useTranslations("dashboard.nav")
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
      <PageBreadcrumbRow
        segments={[
          { label: tNav("admin"), href: "/admin" },
          { label: tTabs("organizations") },
        ]}
      />
      <FrameTable
        title={tTabs("organizations")}
        count={orgs === undefined ? undefined : filtered.length}
        countIcon={Building01Icon}
        toolbar={<CreateOrganizationDialog />}
        filters={
          <TableSearchField
            value={query}
            placeholder={t("searchPlaceholder")}
            onChange={setQuery}
            className="w-72"
          />
        }
      >
        {orgs !== undefined && filtered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              {query.trim() === "" && (
                <EmptyMedia>
                  <Medallion icon={Building01Icon} size="lg" />
                </EmptyMedia>
              )}
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
                <TableHead className="text-right">
                  {/* Row actions need no visible heading; the label stays for
                    screen readers. */}
                  <span className="sr-only">{t("table.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((org) => (
                <TableRow key={org.orgId}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Avatar
                        key={org.imageUrl ?? "no-logo"}
                        variant="brand"
                        className="shrink-0"
                      >
                        {org.imageUrl ? (
                          <AvatarImage src={org.imageUrl} alt={org.name} />
                        ) : null}
                        <AvatarFallback>{initialsOf(org.name)}</AvatarFallback>
                      </Avatar>
                      <span>{org.name}</span>
                    </div>
                  </TableCell>
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
                        <DropdownMenuTrigger
                          render={
                            <ActionsMenuTrigger
                              aria-label={t("rowActions", { name: org.name })}
                            />
                          }
                        >
                          <HugeiconsIcon
                            icon={MoreVerticalIcon}
                            strokeWidth={2}
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setManageOrgId(org.orgId)}
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
      </FrameTable>
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
