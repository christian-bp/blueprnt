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
import { useMutation } from "convex/react"
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

// Read-first job profile: an Edit toggle swaps the texts for inputs, Save
// patches only what changed. Archived roles never enter edit
// mode (the backend rejects them with errors.roleLocked anyway).
export function RoleProfileCard({
  orgId,
  role,
}: {
  orgId: string
  role: RoleProfile
}) {
  const t = useTranslations("dashboard.roles.detail")
  const tRole = useTranslations("assessment.role")
  const tFamily = useTranslations("dashboard.roles.family")
  const tModel = useTranslations("model")
  const tAi = useTranslations("dashboard.ai")
  const tErrors = useTranslations("errors")
  const updateRole = useMutation(api.assessment.roles.updateRole)

  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<"duplicate" | "generic" | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [draftFamilyId, setDraftFamilyId] = useState<string | null>(null)

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
            {/* The AI draft popover sits next to Edit, the same pattern as
                the model editor's Review button. */}
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={editing ? handleSave : startEditing}
            >
              {editing ? t("saveCta") : t("editCta")}
            </Button>
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
            {editing ? (
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
        {failure !== null && (
          <p role="alert" className="text-destructive text-sm">
            {failure === "duplicate" ? tErrors("roleExists") : t("saveError")}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
