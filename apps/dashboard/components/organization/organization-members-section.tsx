"use client"

import { MoreVerticalIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
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
import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useOrganization } from "@/components/org-context"
import { authClient } from "@/lib/auth-client"

type ListResult = Awaited<
  ReturnType<typeof authClient.organization.listInvitations>
>
type InvitationItem = NonNullable<ListResult["data"]>[number]

// The team table (admin-only surface): active members plus pending invitations
// in one roster, distinguished by a "Pending" badge. Members come from the
// reactive Convex query; invitations come from the Better Auth organization
// client (the source of truth for invites) and refetch when refreshKey changes
// (a new invite bumps it). Role changes and removals go through the admin-gated
// Convex mutations (last-admin guard + explicit audit); revoking fires the
// wired invitation.revoked audit trigger. The sole admin's destructive actions
// are disabled and a footnote explains why; the backend re-checks regardless.
export function OrganizationMembersSection(props: { refreshKey: number }) {
  const t = useTranslations("dashboard.organization.members")
  const ti = useTranslations("dashboard.organization.invitations")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const { data: session } = authClient.useSession()
  const members = useQuery(api.accounts.organization.listOrgMembers, { orgId })
  const updateRole = useMutation(api.accounts.organization.updateMemberRole)
  const removeMember = useMutation(api.accounts.organization.removeMember)

  const [invitations, setInvitations] = useState<InvitationItem[] | null>(null)
  const [error, setError] = useState<null | "member" | "invite">(null)
  const [busy, setBusy] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<{
    userId: string
    name: string
  } | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<{
    id: string
    email: string
  } | null>(null)

  const refreshInvitations = useCallback(async () => {
    const { data, error: listError } =
      await authClient.organization.listInvitations({
        query: { organizationId: orgId },
      })
    if (listError) {
      setError("invite")
      return
    }
    setInvitations((data ?? []).filter((i) => i.status === "pending"))
  }, [orgId])

  useEffect(() => {
    // props.refreshKey is a refetch signal: a new invite bumps it, which
    // re-runs this effect to reload the pending list.
    void props.refreshKey
    void refreshInvitations()
  }, [refreshInvitations, props.refreshKey])

  const myId = session?.user?.id
  const list = members ?? []
  const pending = invitations ?? []
  const adminCount = list.filter((m) => m.role === "admin").length
  const isEmpty =
    members !== undefined && list.length === 0 && pending.length === 0

  function roleLabel(role?: string | null) {
    return role === "admin" ? t("roleAdmin") : t("roleEditor")
  }

  async function handleRole(userId: string, role: "admin" | "editor") {
    setError(null)
    try {
      await updateRole({ orgId, userId, role })
      toast.success(tToast("memberRoleUpdated"))
    } catch {
      setError("member")
    }
  }

  async function confirmRemove() {
    if (removeTarget === null) return
    setError(null)
    setBusy(true)
    try {
      await removeMember({ orgId, userId: removeTarget.userId })
      setRemoveTarget(null)
      toast.success(tToast("memberRemoved"))
    } catch {
      setError("member")
    } finally {
      setBusy(false)
    }
  }

  async function confirmRevoke() {
    if (revokeTarget === null) return
    setError(null)
    setBusy(true)
    const { error: revokeError } =
      await authClient.organization.cancelInvitation({
        invitationId: revokeTarget.id,
      })
    setBusy(false)
    if (revokeError) {
      setError("invite")
      return
    }
    setRevokeTarget(null)
    toast.success(tToast("invitationRevoked"))
    void refreshInvitations()
  }

  return (
    <div className="space-y-3">
      {isEmpty ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon
                icon={UserMultipleIcon}
                strokeWidth={2}
                aria-hidden="true"
              />
            </EmptyMedia>
            <EmptyTitle>{t("title")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.email")}</TableHead>
              <TableHead>{t("table.role")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((m) => {
              const isSoleAdmin = m.role === "admin" && adminCount === 1
              return (
                <TableRow key={m.userId}>
                  <TableCell className="font-medium">
                    {m.name}
                    {m.userId === myId ? (
                      <span className="text-muted-foreground">
                        {" "}
                        ({t("you")})
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{roleLabel(m.role)}</Badge>
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
                              aria-label={t("memberActions", { name: m.name })}
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
                          {m.role === "editor" ? (
                            <DropdownMenuItem
                              onClick={() => handleRole(m.userId, "admin")}
                            >
                              {t("changeRoleAdmin")}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              disabled={isSoleAdmin}
                              onClick={() => handleRole(m.userId, "editor")}
                            >
                              {t("changeRoleEditor")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={isSoleAdmin}
                            onClick={() =>
                              setRemoveTarget({
                                userId: m.userId,
                                name: m.name,
                              })
                            }
                          >
                            {t("remove")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {pending.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>
                  <Badge variant="outline">{t("pending")}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {inv.email}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{roleLabel(inv.role)}</Badge>
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
                            aria-label={ti("invitationActions", {
                              email: inv.email,
                            })}
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
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() =>
                            setRevokeTarget({ id: inv.id, email: inv.email })
                          }
                        >
                          {ti("revoke")}
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
      {adminCount === 1 ? (
        <p className="text-muted-foreground text-xs">{t("soleAdminNote")}</p>
      ) : null}
      {error === "member" && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
      {error === "invite" && (
        <p role="alert" className="text-destructive text-sm">
          {ti("error")}
        </p>
      )}

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("removeConfirmTitle", { name: removeTarget?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={confirmRemove}
            >
              {t("removeConfirmCta")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ti("revokeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {ti("revokeConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ti("cancel")}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={confirmRevoke}
            >
              {ti("revokeConfirmCta")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
