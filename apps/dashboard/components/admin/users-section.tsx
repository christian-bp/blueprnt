"use client"

import { Medallion } from "@/components/medallion"
import { MoreVerticalIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
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
import { CreateUserDialog } from "@/components/admin/create-user-dialog"
import { DeleteUserDialog } from "@/components/admin/delete-user-dialog"
import { ManageUserOrganizationsDialog } from "@/components/admin/manage-user-organizations-dialog"
import { TableSearchField } from "@/components/table-search-field"
import { FrameTable } from "@/components/frame-table"
import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"
import { authClient } from "@/lib/auth-client"
import { initialsOf } from "@/lib/initials"

export function UsersSection() {
  const t = useTranslations("dashboard.admin.users")
  const tTabs = useTranslations("dashboard.admin.tabs")
  const tNav = useTranslations("dashboard.nav")
  const users = useQuery(api.platform.admin.listUsers, {})
  const [query, setQuery] = useState("")
  const [resendFeedback, setResendFeedback] = useState<{
    email: string
    ok: boolean
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    authId: string
    name: string
    email: string
  } | null>(null)
  const [orgTarget, setOrgTarget] = useState<{
    authId: string
    name: string
    email: string
  } | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (users === undefined) return []
    if (q === "") return users
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [users, query])

  async function resend(email: string) {
    setResendFeedback(null)
    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      })
      setResendFeedback({ email, ok: true })
    } catch {
      setResendFeedback({ email, ok: false })
    }
  }

  return (
    <section className="space-y-4">
      <PageBreadcrumbRow
        segments={[{ label: tNav("admin") }, { label: tTabs("users") }]}
      />
      <FrameTable
        title={tTabs("users")}
        count={users === undefined ? undefined : filtered.length}
        toolbar={<CreateUserDialog />}
        filters={
          <TableSearchField
            value={query}
            placeholder={t("searchPlaceholder")}
            onChange={setQuery}
            className="w-72"
          />
        }
      >
        {resendFeedback !== null &&
          (resendFeedback.ok ? (
            <p role="status" className="text-muted-foreground text-sm">
              {t("resendDone")}
            </p>
          ) : (
            <p role="alert" className="text-destructive text-sm">
              {t("resendError")}
            </p>
          ))}
        {users !== undefined && filtered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              {query.trim() === "" && (
                <EmptyMedia>
                  <Medallion icon={UserMultipleIcon} size="lg" />
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
                <TableHead>{t("table.email")}</TableHead>
                <TableHead>{t("table.platformAdmin")}</TableHead>
                <TableHead className="text-right">
                  {/* Row actions need no visible heading; the label stays for
                    screen readers. */}
                  <span className="sr-only">{t("table.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.authId}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Avatar
                        key={user.image ?? "no-avatar"}
                        className="shrink-0"
                      >
                        {user.image ? (
                          <AvatarImage src={user.image} alt={user.name} />
                        ) : null}
                        <AvatarFallback>
                          {initialsOf(user.name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    {user.isPlatformAdmin && (
                      <Badge variant="secondary">
                        {t("platformAdminBadge")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t("rowActions", { name: user.name })}
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                            />
                          }
                        >
                          <HugeiconsIcon
                            icon={MoreVerticalIcon}
                            strokeWidth={2}
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => resend(user.email)}>
                            {t("resendInvite")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setOrgTarget({
                                authId: user.authId,
                                name: user.name,
                                email: user.email,
                              })
                            }
                          >
                            {t("organizationsCta")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() =>
                              setDeleteTarget({
                                authId: user.authId,
                                name: user.name,
                                email: user.email,
                              })
                            }
                          >
                            {t("deleteCta")}
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
      <DeleteUserDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
        authId={deleteTarget?.authId ?? ""}
        name={deleteTarget?.name ?? ""}
        email={deleteTarget?.email ?? ""}
      />
      {orgTarget !== null && (
        <ManageUserOrganizationsDialog
          user={orgTarget}
          open={orgTarget !== null}
          onOpenChange={(o) => {
            if (!o) setOrgTarget(null)
          }}
        />
      )}
    </section>
  )
}
