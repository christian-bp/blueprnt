"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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
import { CreateUserDialog } from "@/components/admin/create-user-dialog"
import { DeleteUserDialog } from "@/components/admin/delete-user-dialog"
import { authClient } from "@/lib/auth-client"

export function UsersSection() {
  const t = useTranslations("dashboard.admin.users")
  const users = useQuery(api.platform.admin.listUsers, {})
  const [query, setQuery] = useState("")
  const [resendFeedback, setResendFeedback] = useState<{
    email: string
    ok: boolean
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium text-lg">{t("heading")}</h2>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <CreateUserDialog />
      </div>
      <Input
        value={query}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        onChange={(event) => setQuery(event.target.value)}
        className="w-72"
      />
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
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => (
              <TableRow key={user.authId}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell>
                  {user.isPlatformAdmin && (
                    <Badge variant="secondary">{t("platformAdminBadge")}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => resend(user.email)}
                    >
                      {t("resendInvite")}
                    </Button>
                    <DeleteUserDialog
                      authId={user.authId}
                      name={user.name}
                      email={user.email}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
