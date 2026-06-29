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
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { AiMagicIcon } from "@hugeicons/core-free-icons"
import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
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
  purpose: string
  responsibilities: string
  archived: boolean
}

// Read-first job profile. Edit mode is entered from the role actions menu (the
// parent owns the `editing` flag and the Edit trigger); this card owns the
// inputs, Save, and the AI draft assistant. Save patches only what changed.
// Archived roles never enter edit mode (the backend rejects them with
// errors.roleLocked anyway).
export function RoleProfileCard({
  orgId,
  role,
  editing,
  onEditingChange,
}: {
  orgId: string
  role: RoleProfile
  editing: boolean
  onEditingChange: (editing: boolean) => void
}) {
  const t = useTranslations("dashboard.roles.detail")
  const tRole = useTranslations("assessment.role")
  const tFamily = useTranslations("dashboard.roles.family")
  const tModel = useTranslations("model")
  const tAi = useTranslations("dashboard.ai")
  const tErrors = useTranslations("errors")
  const updateRole = useMutation(api.assessment.roles.updateRole)
  // The org's other roles, to catch a title already taken in the target family
  // (rename or family move) before submitting, so it never throws server-side.
  const allRoles = useQuery(api.assessment.roles.listRoles, { orgId })

  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<"duplicate" | "generic" | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [draftFamilyId, setDraftFamilyId] = useState<string | null>(null)

  const locked = role.archived
  // An archived role can never be edited, even if the parent passes editing.
  const isEditing = editing && !locked

  function currentValues(): Record<string, string> {
    return {
      title: role.title,
      function: role.function,
      team: role.team,
      purpose: role.purpose,
      responsibilities: role.responsibilities,
    }
  }

  // Seed the draft from the live role the moment edit mode opens. This adjusts
  // state during render on the false->true transition (React's documented
  // "adjusting state when a prop changes" pattern), so the inputs are populated
  // before paint with no flash and without an effect.
  const [seeded, setSeeded] = useState(false)
  if (isEditing && !seeded) {
    setSeeded(true)
    setDraft(currentValues())
    setDraftFamilyId(role.familyId ?? null)
    setFailure(null)
  } else if (!isEditing && seeded) {
    setSeeded(false)
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
      }
      onEditingChange(false)
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
    isEditing &&
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
            {/* The AI draft popover stays in the card, next to the content it
                drafts. Edit is entered from the role actions menu; Save appears
                here only while editing. */}
            <MorphPopover
              triggerLabel={tAi("openDraftCta")}
              triggerIcon={AiMagicIcon}
              title={tAi("heading")}
              description={tAi("provenance")}
              closeLabel={tAi("closeLabel")}
            >
              {(close) => (
                <RoleAiPanel
                  orgId={orgId}
                  roleId={role.roleId}
                  onDone={close}
                />
              )}
            </MorphPopover>
            {isEditing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || duplicate}
                onClick={handleSave}
              >
                {t("saveCta")}
              </Button>
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
              {isEditing ? (
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
          {isEditing ? (
            <FamilyPicker
              orgId={orgId}
              value={draftFamilyId}
              onChange={setDraftFamilyId}
            />
          ) : (
            <p id="profile-family" className="text-sm">
              {role.familyName ?? tFamily("none")}
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
            {isEditing ? (
              <Textarea
                id={`profile-${row.key}`}
                value={draft[row.key] ?? ""}
                rows={3}
                onChange={(event) => setField(row.key, event.target.value)}
              />
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
    </Card>
  )
}
