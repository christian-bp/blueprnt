"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { HelpPopover } from "@/components/help-popover"
import { useOrganization } from "@/components/org-context"

// The anchor-role section of the role page. Anchor roles (ankarroller) are
// the org's 2-5 designated reference roles used to calibrate other
// assessments; designating and reviewing them is model governance, so all
// write controls are admin-only. The designation itself lives as an
// aggregate on the role (assessment/anchorRoles.ts owns the lifecycle).
//
// States:
//   not an anchor + admin: designate form (agreed band + motivation),
//     gated on a complete assessment so every anchor has a criteria profile.
//   not an anchor + non-admin: nothing (the concept only appears once real).
//   anchor + admin: the stored values as live controls plus a save button,
//     including the lifecycle status (active / under review / replaced).
//   anchor + non-admin: read-only designation summary.

interface AnchorRoleInfo {
  expectedBand: number
  motivation: string
  status: "active" | "underReview" | "replaced"
  reviewedAt: number
}

const STATUS_KEYS = {
  active: "statusActive",
  underReview: "statusUnderReview",
  replaced: "statusReplaced",
} as const

const STATUS_BADGE_VARIANTS = {
  active: "default",
  underReview: "secondary",
  replaced: "outline",
} as const

// One reserved line under the action button: the failure text appears inside
// it, so an error never reflows the controls above (layout-shift rule). A
// rare two-line wrap only extends the card downwards.
function ErrorSlot({ failed }: { failed: boolean }) {
  const t = useTranslations("dashboard.roles.anchor")
  return (
    <p aria-live="polite" className="min-h-5 text-destructive text-sm">
      {failed ? t("error") : null}
    </p>
  )
}

function BandField({
  band,
  bandOptions,
  disabled,
  onChange,
}: {
  band: string
  bandOptions: number[]
  disabled: boolean
  onChange: (value: string) => void
}) {
  const t = useTranslations("dashboard.roles.anchor")
  return (
    <div className="space-y-2">
      <Label htmlFor="anchor-band" className="text-muted-foreground">
        {t("expectedBandLabel")}
      </Label>
      <Select value={band} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="anchor-band" className="w-full">
          <SelectValue placeholder={t("expectedBandLabel")} />
        </SelectTrigger>
        <SelectContent>
          {bandOptions.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {t("bandOption", { band: option })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function MotivationField({
  motivation,
  disabled,
  onChange,
}: {
  motivation: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const t = useTranslations("dashboard.roles.anchor")
  return (
    <div className="space-y-2">
      <Label htmlFor="anchor-motivation" className="text-muted-foreground">
        {t("motivationLabel")}
      </Label>
      <Textarea
        id="anchor-motivation"
        value={motivation}
        placeholder={t("motivationPlaceholder")}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function ReviewedLine({ reviewedAt }: { reviewedAt: number }) {
  const t = useTranslations("dashboard.roles.anchor")
  const locale = useLocale()
  return (
    <p className="text-muted-foreground text-xs">
      {t("reviewedAt", {
        date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
          reviewedAt
        ),
      })}
    </p>
  )
}

// Designate form: agreed band + motivation, plus the 2-5 guideline hint from
// the anchor-role guide (a warning once 5 anchors are already active).
function DesignateForm({
  orgId,
  roleId,
  bandOptions,
  activeCount,
}: {
  orgId: string
  roleId: Id<"roles">
  bandOptions: number[]
  activeCount: number
}) {
  const t = useTranslations("dashboard.roles.anchor")
  const designate = useMutation(api.assessment.anchorRoles.designateAnchorRole)
  const [band, setBand] = useState("")
  const [motivation, setMotivation] = useState("")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  const trimmedMotivation = motivation.trim()

  async function handleDesignate() {
    setPending(true)
    setFailed(false)
    try {
      await designate({
        orgId,
        roleId,
        expectedBand: Number(band),
        motivation: trimmedMotivation,
      })
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <BandField
        band={band}
        bandOptions={bandOptions}
        disabled={pending}
        onChange={setBand}
      />
      <MotivationField
        motivation={motivation}
        disabled={pending}
        onChange={setMotivation}
      />
      <p className="text-muted-foreground text-xs">
        {activeCount >= 5
          ? t("tooMany", { count: activeCount })
          : t("countHint")}
      </p>
      <Button
        onClick={handleDesignate}
        disabled={pending || band === "" || trimmedMotivation === ""}
      >
        {t("designateCta")}
      </Button>
      <ErrorSlot failed={failed} />
    </>
  )
}

// Admin controls for an existing designation. The caller keys this component
// by anchorRole.reviewedAt (bumped on every update), so a concurrent admin's
// save remounts the form with the fresh values instead of letting stale local
// state silently overwrite the other edit on the next save.
function AnchorRoleEditForm({
  orgId,
  roleId,
  anchorRole,
  bandOptions,
}: {
  orgId: string
  roleId: Id<"roles">
  anchorRole: AnchorRoleInfo
  bandOptions: number[]
}) {
  const t = useTranslations("dashboard.roles.anchor")
  const update = useMutation(api.assessment.anchorRoles.updateAnchorRole)
  const [band, setBand] = useState(String(anchorRole.expectedBand))
  const [motivation, setMotivation] = useState(anchorRole.motivation)
  const [status, setStatus] = useState<AnchorRoleInfo["status"]>(
    anchorRole.status
  )
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  const trimmedMotivation = motivation.trim()
  const dirty =
    Number(band) !== anchorRole.expectedBand ||
    trimmedMotivation !== anchorRole.motivation ||
    status !== anchorRole.status

  async function handleUpdate() {
    setPending(true)
    setFailed(false)
    try {
      await update({
        orgId,
        roleId,
        ...(Number(band) !== anchorRole.expectedBand
          ? { expectedBand: Number(band) }
          : {}),
        ...(trimmedMotivation !== anchorRole.motivation
          ? { motivation: trimmedMotivation }
          : {}),
        ...(status !== anchorRole.status ? { status } : {}),
      })
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <BandField
        band={band}
        bandOptions={bandOptions}
        disabled={pending}
        onChange={setBand}
      />
      <MotivationField
        motivation={motivation}
        disabled={pending}
        onChange={setMotivation}
      />
      <div className="space-y-2">
        <Label htmlFor="anchor-status" className="text-muted-foreground">
          {t("statusLabel")}
        </Label>
        <Select
          value={status}
          onValueChange={(value) =>
            setStatus(value as AnchorRoleInfo["status"])
          }
          disabled={pending}
        >
          <SelectTrigger id="anchor-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_KEYS) as AnchorRoleInfo["status"][]).map(
              (option) => (
                <SelectItem key={option} value={option}>
                  {t(STATUS_KEYS[option])}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>
      <ReviewedLine reviewedAt={anchorRole.reviewedAt} />
      <Button
        onClick={handleUpdate}
        disabled={pending || !dirty || trimmedMotivation === ""}
      >
        {t("updateCta")}
      </Button>
      <ErrorSlot failed={failed} />
    </>
  )
}

export function AnchorRoleCard({
  orgId,
  roleId,
  anchorRole,
  assessmentComplete,
  archived,
}: {
  orgId: string
  roleId: Id<"roles">
  anchorRole: AnchorRoleInfo | null
  assessmentComplete: boolean
  archived: boolean
}) {
  const t = useTranslations("dashboard.roles.anchor")
  const tHelp = useTranslations("dashboard.help")
  const { role: orgRole } = useOrganization()
  const isAdmin = orgRole === "admin"

  // The model only feeds the band options and the anchor list only feeds the
  // 2-5 count hint, so neither loads for viewers who never see the controls.
  const model = useQuery(
    api.evaluationModel.model.getModel,
    isAdmin ? { orgId } : "skip"
  )
  const anchors = useQuery(
    api.assessment.anchorRoles.listAnchorRoles,
    isAdmin && anchorRole === null ? { orgId } : "skip"
  )

  // Designating is closed on archived roles (the backend rejects it too);
  // an existing designation stays visible so the retirement is on record.
  if (anchorRole === null && (!isAdmin || archived)) return null
  // The card is the last item in its column, so waiting for its queries only
  // delays content that extends below the page; it never appears half-built
  // (empty band select, hint text swapping) and nothing on screen reflows.
  if (isAdmin && model === undefined) return null
  if (isAdmin && anchorRole === null && anchors === undefined) return null

  const bandOptions = Array.from(
    { length: model?.bandThresholds.length ?? 0 },
    (_, index) => index + 1
  )
  const activeCount = (anchors ?? []).filter(
    (anchor) => anchor.status === "active"
  ).length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {t("heading")}
          <HelpPopover label={tHelp("anchorRoleLabel")}>
            {tHelp("anchorRoleBody")}
          </HelpPopover>
        </CardTitle>
        {anchorRole !== null && (
          <Badge variant={STATUS_BADGE_VARIANTS[anchorRole.status]}>
            {t(STATUS_KEYS[anchorRole.status])}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {anchorRole === null ? (
          assessmentComplete ? (
            <DesignateForm
              orgId={orgId}
              roleId={roleId}
              bandOptions={bandOptions}
              activeCount={activeCount}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("requiresAssessment")}
            </p>
          )
        ) : isAdmin ? (
          <AnchorRoleEditForm
            key={anchorRole.reviewedAt}
            orgId={orgId}
            roleId={roleId}
            anchorRole={anchorRole}
            bandOptions={bandOptions}
          />
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">
                {t("expectedBandLabel")}
              </p>
              <Badge variant="outline">
                {t("bandOption", { band: anchorRole.expectedBand })}
              </Badge>
            </div>
            <p className="text-sm">{anchorRole.motivation}</p>
            <ReviewedLine reviewedAt={anchorRole.reviewedAt} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
