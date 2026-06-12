"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { FamilyPicker } from "@/components/roles/family-picker"

// Structural subset of getModel's tracks: the stable key (typed as the fixed
// V1 literal union, ADR-0006) flows through to the mutation untouched.
export interface TrackOption {
  key: "IC" | "Lead" | "M"
  name: string
  order: number
}

// The basics only (title, function, team, track): purpose and
// responsibilities are filled on the role page, by hand or via the AI draft.
export function CreateRoleDialog({
  orgId,
  tracks,
  triggerLabel,
}: {
  orgId: string
  tracks: TrackOption[]
  triggerLabel: string
}) {
  const t = useTranslations("dashboard.roles.create")
  const tHelp = useTranslations("dashboard.help")
  const tModel = useTranslations("model")
  const createRole = useMutation(api.assessment.roles.createRole)
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [roleFunction, setRoleFunction] = useState("")
  const [team, setTeam] = useState("")
  const firstTrack = tracks[0]
  const [trackKey, setTrackKey] = useState<TrackOption["key"] | "">(
    firstTrack?.key ?? ""
  )
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  const canSubmit =
    title.trim().length > 0 &&
    roleFunction.trim().length > 0 &&
    team.trim().length > 0 &&
    trackKey !== "" &&
    !pending

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    // Closing discards the draft: a reopened dialog always starts clean.
    if (!nextOpen) {
      setTitle("")
      setRoleFunction("")
      setTeam("")
      setTrackKey(firstTrack?.key ?? "")
      setFamilyId(null)
      setFailed(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // canSubmit aliases trackKey !== "", so trackKey narrows to the union.
    if (!canSubmit) return
    setPending(true)
    setFailed(false)
    try {
      const roleId = await createRole({
        orgId,
        title: title.trim(),
        function: roleFunction.trim(),
        team: team.trim(),
        trackKey,
        ...(familyId !== null ? { familyId: familyId as never } : {}),
      })
      setOpen(false)
      router.push(`/roles/${roleId}`)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-title">{t("titleLabel")}</Label>
            <Input
              id="role-title"
              value={title}
              placeholder={t("titlePlaceholder")}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role-function">{t("functionLabel")}</Label>
              <Input
                id="role-function"
                value={roleFunction}
                onChange={(event) => setRoleFunction(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-team">{t("teamLabel")}</Label>
              <Input
                id="role-team"
                value={team}
                onChange={(event) => setTeam(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="role-track">{t("trackLabel")}</Label>
              <HelpMorphButton label={tHelp("trackLabel")}>
                {tHelp("trackBody")}
              </HelpMorphButton>
            </div>
            <Select
              value={trackKey}
              // The Select's values are our own SelectItems below, so the
              // string narrows safely back to the track key union.
              onValueChange={(value) =>
                setTrackKey(value as TrackOption["key"])
              }
            >
              <SelectTrigger id="role-track" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tracks.map((track) => (
                  <SelectItem key={track.key} value={track.key}>
                    {track.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>{tModel("roleFamily")}</Label>
              <HelpMorphButton label={tHelp("familyLabel")}>
                {tHelp("familyBody")}
              </HelpMorphButton>
            </div>
            <FamilyPicker
              orgId={orgId}
              value={familyId}
              onChange={setFamilyId}
            />
          </div>
          {failed && (
            <p role="alert" className="text-destructive text-sm">
              {t("error")}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {t("cta")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
