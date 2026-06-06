"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { FamilyPicker } from "@/components/roles/family-picker"

// Structural subset of getModel's tracks; the branded ids flow through to
// the mutation untouched.
export interface TrackOption {
  trackId: string
  key: string
  name: string
  order: number
  levels: { levelId: string; key: string; name: string; order: number }[]
}

// The basics only (title, function, team, track, level): purpose and
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
  const tModel = useTranslations("model")
  const createRole = useMutation(api.assessment.roles.createRole)
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [roleFunction, setRoleFunction] = useState("")
  const [team, setTeam] = useState("")
  const firstTrack = tracks[0]
  const [trackId, setTrackId] = useState(firstTrack?.trackId ?? "")
  const [levelId, setLevelId] = useState(firstTrack?.levels[0]?.levelId ?? "")
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  const selectedTrack = tracks.find((track) => track.trackId === trackId)
  const canSubmit =
    title.trim().length > 0 &&
    roleFunction.trim().length > 0 &&
    team.trim().length > 0 &&
    trackId !== "" &&
    levelId !== "" &&
    !pending

  function handleTrackChange(nextTrackId: string) {
    setTrackId(nextTrackId)
    // The old level never belongs to the new track: reset to its first level.
    const nextTrack = tracks.find((track) => track.trackId === nextTrackId)
    setLevelId(nextTrack?.levels[0]?.levelId ?? "")
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    // Closing discards the draft: a reopened dialog always starts clean.
    if (!nextOpen) {
      setTitle("")
      setRoleFunction("")
      setTeam("")
      setTrackId(firstTrack?.trackId ?? "")
      setLevelId(firstTrack?.levels[0]?.levelId ?? "")
      setFamilyId(null)
      setFailed(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setPending(true)
    setFailed(false)
    try {
      const roleId = await createRole({
        orgId,
        title: title.trim(),
        function: roleFunction.trim(),
        team: team.trim(),
        trackId: trackId as never,
        levelId: levelId as never,
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role-track">{t("trackLabel")}</Label>
              <Select value={trackId} onValueChange={handleTrackChange}>
                <SelectTrigger id="role-track" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tracks.map((track) => (
                    <SelectItem key={track.trackId} value={track.trackId}>
                      {track.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-level">{t("levelLabel")}</Label>
              <Select value={levelId} onValueChange={setLevelId}>
                <SelectTrigger id="role-level" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(selectedTrack?.levels ?? []).map((level) => (
                    <SelectItem key={level.levelId} value={level.levelId}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{tModel("roleFamily")}</Label>
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
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {t("cta")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
