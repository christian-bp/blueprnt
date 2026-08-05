"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "@/lib/toast"
import { onSelectValue } from "@/lib/select"

// Anchor roles (ankarroller) are the org's 2-5 designated reference roles used
// to calibrate other assessments; designating/reviewing them is model
// governance, so all write controls are admin-only. The designation lives as an
// aggregate on the role. This module exports AnchorDialog (the designate/edit
// form in a dialog, admin-only) and the AnchorRoleInfo type; the Evaluation
// card shows the anchor level + help inline and opens this dialog to manage it.
export interface AnchorRoleInfo {
  expectedLevel: number
  motivation: string
  status: "active" | "underReview" | "replaced"
  reviewedAt: number
}

const STATUS_KEYS = {
  active: "statusActive",
  underReview: "statusUnderReview",
  replaced: "statusReplaced",
} as const

function LevelField({
  level,
  levelOptions,
  disabled,
  onChange,
}: {
  level: string
  levelOptions: number[]
  disabled: boolean
  onChange: (value: string) => void
}) {
  const t = useTranslations("dashboard.roles.anchor")
  return (
    <div className="space-y-2">
      <Label htmlFor="anchor-level" className="text-muted-foreground">
        {t("expectedLevelLabel")}
      </Label>
      <Select
        value={level}
        onValueChange={onSelectValue(onChange)}
        disabled={disabled}
        items={levelOptions.map((option) => ({
          value: String(option),
          label: t("levelOption", { level: option }),
        }))}
      >
        <SelectTrigger id="anchor-level" className="w-full">
          <SelectValue placeholder={t("expectedLevelLabel")} />
        </SelectTrigger>
        <SelectContent>
          {levelOptions.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {t("levelOption", { level: option })}
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

// Footer error: a simple inline alert above the dialog footer (the dialog can
// grow without reflowing the page, so no reserved-height slot is needed).
function FormError({ failed }: { failed: boolean }) {
  const t = useTranslations("dashboard.roles.anchor")
  return failed ? (
    <p role="alert" className="text-destructive text-sm">
      {t("error")}
    </p>
  ) : null
}

function DesignateForm({
  orgId,
  roleId,
  levelOptions,
  onClose,
}: {
  orgId: string
  roleId: Id<"roles">
  levelOptions: number[]
  onClose: () => void
}) {
  const t = useTranslations("dashboard.roles.anchor")
  const tToast = useTranslations("dashboard.toast")
  const designate = useMutation(api.assessment.anchorRoles.designateAnchorRole)
  const anchors = useQuery(api.assessment.anchorRoles.listAnchorRoles, {
    orgId,
  })
  const activeCount = (anchors ?? []).filter(
    (a) => a.status === "active"
  ).length
  const [level, setLevel] = useState("")
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
        expectedLevel: Number(level),
        motivation: trimmedMotivation,
      })
      toast.success(tToast("anchorSet"))
      onClose()
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <LevelField
        level={level}
        levelOptions={levelOptions}
        disabled={pending}
        onChange={setLevel}
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
      <FormError failed={failed} />
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={pending}
        >
          {t("cancel")}
        </Button>
        <Button
          onClick={handleDesignate}
          disabled={pending || level === "" || trimmedMotivation === ""}
        >
          {t("designateCta")}
        </Button>
      </DialogFooter>
    </div>
  )
}

function EditForm({
  orgId,
  roleId,
  anchorRole,
  levelOptions,
  onClose,
}: {
  orgId: string
  roleId: Id<"roles">
  anchorRole: AnchorRoleInfo
  levelOptions: number[]
  onClose: () => void
}) {
  const t = useTranslations("dashboard.roles.anchor")
  const tToast = useTranslations("dashboard.toast")
  const update = useMutation(api.assessment.anchorRoles.updateAnchorRole)
  const [level, setLevel] = useState(String(anchorRole.expectedLevel))
  const [motivation, setMotivation] = useState(anchorRole.motivation)
  const [status, setStatus] = useState<AnchorRoleInfo["status"]>(
    anchorRole.status
  )
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const trimmedMotivation = motivation.trim()
  const dirty =
    Number(level) !== anchorRole.expectedLevel ||
    trimmedMotivation !== anchorRole.motivation ||
    status !== anchorRole.status

  async function handleUpdate() {
    setPending(true)
    setFailed(false)
    try {
      await update({
        orgId,
        roleId,
        ...(Number(level) !== anchorRole.expectedLevel
          ? { expectedLevel: Number(level) }
          : {}),
        ...(trimmedMotivation !== anchorRole.motivation
          ? { motivation: trimmedMotivation }
          : {}),
        ...(status !== anchorRole.status ? { status } : {}),
      })
      toast.success(tToast("anchorUpdated"))
      onClose()
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <LevelField
        level={level}
        levelOptions={levelOptions}
        disabled={pending}
        onChange={setLevel}
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
          items={Object.fromEntries(
            (Object.keys(STATUS_KEYS) as AnchorRoleInfo["status"][]).map(
              (option) => [option, t(STATUS_KEYS[option])]
            )
          )}
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
      <FormError failed={failed} />
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={pending}
        >
          {t("cancel")}
        </Button>
        <Button
          onClick={handleUpdate}
          disabled={pending || !dirty || trimmedMotivation === ""}
        >
          {t("updateCta")}
        </Button>
      </DialogFooter>
    </div>
  )
}

// Loads the level options when open; renders the designate or edit form. The
// edit form is keyed by reviewedAt so a concurrent admin's update remounts it
// with fresh values instead of overwriting silently.
export function AnchorDialog({
  open,
  onOpenChange,
  orgId,
  roleId,
  anchorRole,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  roleId: Id<"roles">
  anchorRole: AnchorRoleInfo | null
}) {
  const t = useTranslations("dashboard.roles.anchor")
  const model = useQuery(
    api.evaluationModel.model.getModel,
    open ? { orgId } : "skip"
  )
  const levelOptions = Array.from(
    { length: model?.levelThresholds.length ?? 0 },
    (_, index) => index + 1
  )
  const close = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("heading")}</DialogTitle>
        </DialogHeader>
        {model === undefined ? (
          <div className="flex justify-center py-6">
            <Spinner aria-label={t("heading")} />
          </div>
        ) : anchorRole === null ? (
          <DesignateForm
            orgId={orgId}
            roleId={roleId}
            levelOptions={levelOptions}
            onClose={close}
          />
        ) : (
          <EditForm
            key={anchorRole.reviewedAt}
            orgId={orgId}
            roleId={roleId}
            anchorRole={anchorRole}
            levelOptions={levelOptions}
            onClose={close}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
