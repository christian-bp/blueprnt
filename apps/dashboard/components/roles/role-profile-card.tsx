"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { AiEditingIcon, MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useState } from "react"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { MorphPopover } from "@/components/morph-popover"
import { FamilyPicker } from "@/components/roles/family-picker"
import { ResponsibilitiesList } from "@/components/roles/responsibilities-list"
import { RoleAiPanel } from "@/components/roles/role-ai-panel"
import { isDuplicateRoleError } from "@/lib/role-error"

// Structural subset of getRole used by this card.
export interface RoleProfile {
  roleId: Id<"roles">
  title: string
  function: string
  team: string
  trackName: string
  familyId: string | null
  familyName: string | null
  familySlug: string | null
  purpose: string
  responsibilities: string
  archived: boolean
}

// Read-first job profile: an Edit toggle swaps the texts for inputs. In edit
// mode the AI panel is available to pre-fill purpose and responsibilities from
// the role context; the user reviews and edits the draft before saving. Save
// patches only what changed. Cancel restores the last saved values. Archived
// roles never enter edit mode (the backend rejects them with roleLocked anyway).
export function RoleProfileCard({
  orgId,
  role,
  isAdmin,
}: {
  orgId: string
  role: RoleProfile
  isAdmin: boolean
}) {
  const t = useTranslations("dashboard.roles.detail")
  const tRole = useTranslations("assessment.role")
  const tFamily = useTranslations("dashboard.roles.family")
  const tModel = useTranslations("model")
  const tAi = useTranslations("dashboard.ai")
  const tErrors = useTranslations("errors")
  const tArchive = useTranslations("dashboard.roles.archive")
  const tToast = useTranslations("dashboard.toast")
  const updateRole = useMutation(api.assessment.roles.updateRole)
  const archiveRole = useMutation(api.assessment.roles.archiveRole)
  const router = useRouter()
  // The org's other roles, to catch a title already taken in the target family
  // (rename or family move) before submitting, so it never throws server-side.
  const allRoles = useQuery(api.assessment.roles.listRoles, { orgId })

  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<"duplicate" | "generic" | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [draftFamilyId, setDraftFamilyId] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [archivePending, setArchivePending] = useState(false)

  const locked = role.archived

  function currentValues(): Record<string, string> {
    return {
      title: role.title,
      function: role.function,
      team: role.team,
      purpose: role.purpose,
      responsibilities: role.responsibilities,
    }
  }

  function startEditing() {
    setDraft(currentValues())
    setDraftFamilyId(role.familyId ?? null)
    setFailure(null)
    setEditing(true)
  }

  function cancelEditing() {
    setDraft({})
    setDraftFamilyId(null)
    setFailure(null)
    setEditing(false)
  }

  async function handleSave() {
    setPending(true)
    setFailure(null)
    // Patch only changed fields so the audit row names what actually moved.
    const patch: Record<string, string> = {}
    const current = currentValues()
    for (const [field, value] of Object.entries(draft)) {
      if (value !== current[field]) patch[field] = value
    }
    // The null sentinel clears membership; undefined leaves it unchanged.
    const familyChange =
      draftFamilyId !== (role.familyId ?? null)
        ? { familyId: draftFamilyId as never }
        : {}
    try {
      if (Object.keys(patch).length > 0 || "familyId" in familyChange) {
        await updateRole({
          orgId,
          roleId: role.roleId,
          ...patch,
          ...familyChange,
        })
        toast.success(tToast("roleUpdated"))
      }
      setEditing(false)
    } catch (error) {
      setFailure(isDuplicateRoleError(error) ? "duplicate" : "generic")
    } finally {
      setPending(false)
    }
  }

  function setField(key: string, value: string) {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }))
  }

  // A duplicate title within the draft's family (excluding this role). Role
  // titles are unique within a family; the same title may exist in another
  // family. Covers both renaming and moving the role to a different family.
  const draftTitle = (draft.title ?? "").trim().toLowerCase()
  const duplicate =
    editing &&
    draftTitle !== "" &&
    (allRoles ?? []).some(
      (r) =>
        r.roleId !== role.roleId &&
        (r.familyId ?? null) === (draftFamilyId ?? null) &&
        r.title.toLowerCase() === draftTitle
    )

  const textRows: { key: string; label: string; value: string }[] = [
    { key: "purpose", label: tRole("purpose"), value: role.purpose },
    {
      key: "responsibilities",
      label: tRole("responsibilities"),
      value: role.responsibilities,
    },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("profileHeading")}</CardTitle>
        {!locked && (
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                {/* AI panel is only available in edit mode so it fills the
                    draft directly; the user reviews and saves. */}
                <MorphPopover
                  triggerLabel={tAi("fillCta")}
                  triggerIcon={AiEditingIcon}
                  title={tAi("heading")}
                  description={t("aiProvenance")}
                  closeLabel={tAi("closeLabel")}
                >
                  {(close) => (
                    <RoleAiPanel
                      orgId={orgId}
                      roleId={role.roleId}
                      onFilled={({ purpose, responsibilities }) => {
                        if (purpose.trim()) setField("purpose", purpose)
                        if (responsibilities.trim())
                          setField("responsibilities", responsibilities)
                      }}
                      onDone={close}
                    />
                  )}
                </MorphPopover>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={cancelEditing}
                >
                  {t("cancelCta")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || duplicate}
                  onClick={handleSave}
                >
                  {t("saveCta")}
                </Button>
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t("manageCta")}
                      className="shrink-0"
                    />
                  }
                >
                  <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => startEditing()}>
                    {t("editCta")}
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setConfirmArchive(true)}
                    >
                      {tArchive("cta")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["title", tRole("title"), role.title],
              ["function", tRole("function"), role.function],
              ["team", tRole("team"), role.team],
            ] as const
          ).map(([key, label, value]) => (
            <div key={key} className="space-y-1">
              <Label
                htmlFor={`profile-${key}`}
                className="text-muted-foreground"
              >
                {label}
              </Label>
              {editing ? (
                <Input
                  id={`profile-${key}`}
                  value={draft[key] ?? ""}
                  onChange={(event) => setField(key, event.target.value)}
                />
              ) : (
                <p id={`profile-${key}`} className="text-sm">
                  {value}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <Label htmlFor="profile-family" className="text-muted-foreground">
            {tModel("roleFamily")}
          </Label>
          {editing ? (
            <FamilyPicker
              orgId={orgId}
              value={draftFamilyId}
              onChange={setDraftFamilyId}
            />
          ) : role.familyName !== null ? (
            <p id="profile-family" className="text-sm">
              {role.familySlug !== null ? (
                <Link
                  href={`/roles/families/${role.familySlug}`}
                  className="underline underline-offset-4"
                >
                  {role.familyName}
                </Link>
              ) : (
                role.familyName
              )}
            </p>
          ) : (
            <p id="profile-family" className="text-sm">
              {tFamily("none")}
            </p>
          )}
        </div>
        {textRows.map((row) => (
          <div key={row.key} className="space-y-1">
            <Label
              htmlFor={`profile-${row.key}`}
              className="text-muted-foreground"
            >
              {row.label}
            </Label>
            {editing ? (
              <>
                <Textarea
                  id={`profile-${row.key}`}
                  value={draft[row.key] ?? ""}
                  rows={3}
                  onChange={(event) => setField(row.key, event.target.value)}
                />
                {/* Responsibilities render one-per-line as a list, so tell the
                    editor to write one per row. */}
                {row.key === "responsibilities" && (
                  <p className="text-muted-foreground text-xs">
                    {t("responsibilitiesHint")}
                  </p>
                )}
              </>
            ) : row.value.trim().length > 0 ? (
              // Responsibilities are one-per-line, so render them as a real
              // bulleted list; purpose stays prose in a pre-line paragraph.
              row.key === "responsibilities" ? (
                <ResponsibilitiesList
                  id={`profile-${row.key}`}
                  value={row.value}
                />
              ) : (
                <p
                  id={`profile-${row.key}`}
                  className="whitespace-pre-line text-sm"
                >
                  {row.value}
                </p>
              )
            ) : (
              <p
                id={`profile-${row.key}`}
                className="text-muted-foreground text-sm italic"
              >
                {t("emptyField")}
              </p>
            )}
          </div>
        ))}
        {duplicate || failure === "duplicate" ? (
          <p role="alert" className="text-destructive text-sm">
            {tErrors("roleExists")}
          </p>
        ) : failure === "generic" ? (
          <p role="alert" className="text-destructive text-sm">
            {t("saveError")}
          </p>
        ) : null}
      </CardContent>
      <ConfirmDeleteDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={tArchive("dialogTitle")}
        description={tArchive("dialogBody")}
        confirmLabel={tArchive("confirm")}
        cancelLabel={tArchive("cancel")}
        pending={archivePending}
        onConfirm={async () => {
          setArchivePending(true)
          try {
            await archiveRole({ orgId, roleId: role.roleId })
            toast.success(tToast("roleArchived"))
            router.push("/roles")
          } catch {
            toast.error(tToast("error"))
          } finally {
            setArchivePending(false)
          }
        }}
      />
    </Card>
  )
}
