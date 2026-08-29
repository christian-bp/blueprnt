"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { LEVEL_COUNT } from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Label } from "@workspace/ui/components/label"
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group"
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

// Name and meaning per status, in the order the cards are offered (the
// lifecycle's own order: in use, being reconsidered, retired). Compile-time
// total over the union, so a fourth status cannot be added to AnchorRoleInfo
// without giving it both a name and a meaning here.
// `as const satisfies` rather than an annotation: the annotation widens the
// values to string and the typed-key check on t() goes with it.
const STATUS_KEYS = {
  active: { name: "statusActive", meaning: "statusActiveMeaning" },
  underReview: {
    name: "statusUnderReview",
    meaning: "statusUnderReviewMeaning",
  },
  replaced: { name: "statusReplaced", meaning: "statusReplacedMeaning" },
} as const satisfies Record<
  AnchorRoleInfo["status"],
  { name: string; meaning: string }
>

const STATUS_ORDER = Object.keys(STATUS_KEYS) as AnchorRoleInfo["status"][]

// Base UI reports the chosen value as the group's generic Value, which the
// vendored wrapper leaves as `any`. Narrowing through the same record that
// supplies the labels means the guard can never drift from the union.
function isAnchorStatus(value: unknown): value is AnchorRoleInfo["status"] {
  return typeof value === "string" && value in STATUS_KEYS
}

// THE STATUS IS A CHOICE BETWEEN MEANINGS, not a value to look up.
//
// It was a select of three words. A select asks the reader to already know
// what "Under översyn" does to an anchor, and to discover it by choosing it;
// the words are the org's bookkeeping vocabulary, not a description of any
// consequence. The choice cards put each status beside the one sentence that
// says what it changes, so the decision is readable before it is made.
//
// The descriptions state what the code actually does, which is not what the
// names suggest: under review keeps flagging deviations and only stops being
// a comparison point for new evaluations.
function StatusField({
  status,
  disabled,
  onChange,
}: {
  status: AnchorRoleInfo["status"]
  disabled: boolean
  onChange: (value: AnchorRoleInfo["status"]) => void
}) {
  const t = useTranslations("dashboard.roles.anchor")
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground">{t("statusLabel")}</Label>
      <RadioGroup
        value={status}
        disabled={disabled}
        onValueChange={(value) => {
          if (isAnchorStatus(value)) onChange(value)
        }}
      >
        {STATUS_ORDER.map((option) => (
          <FieldLabel key={option} htmlFor={`anchor-status-${option}`}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{t(STATUS_KEYS[option].name)}</FieldTitle>
                <FieldDescription>
                  {t(STATUS_KEYS[option].meaning)}
                </FieldDescription>
              </FieldContent>
              {/* The id lands on Base UI's hidden input rather than on this
                  span (useLabelableId), which is what makes the card's
                  htmlFor point at a labelable control instead of at a role
                  the browser cannot associate. The group owns `disabled`;
                  it reaches each item through context. */}
              <RadioGroupItem value={option} id={`anchor-status-${option}`} />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
    </div>
  )
}

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
      <p className="text-muted-foreground text-sm">
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
      <StatusField status={status} disabled={pending} onChange={setStatus} />
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

// Renders the designate or edit form. The level options are the architecture's
// twelve levels (method law, not a per-org setting), so the dialog opens with
// them already known. The edit form is keyed by reviewedAt so a concurrent
// admin's update remounts it with fresh values instead of overwriting silently.
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
  const levelOptions = Array.from(
    { length: LEVEL_COUNT },
    (_, index) => index + 1
  )
  const close = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("heading")}</DialogTitle>
        </DialogHeader>
        {anchorRole === null ? (
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
