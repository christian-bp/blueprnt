"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { CriterionEditor } from "@/components/onboarding/criterion-editor"
import { ModelReview } from "@/components/onboarding/model-review"
import { OptionCard } from "@/components/option-card"

type Mode = "choice" | "template-review" | "scratch-editor"
type Choice = "template" | "scratch" | null

// Screen 5: the gate keeps the wizard mounted for the whole onboarding session,
// so the choice, review, and editor screens live in LOCAL state after the
// create call. "Continue" hands control back to the wizard (onContinue), which
// advances to the families screen.
//
// Resume: a reload lands here whenever a model already exists but onboarding
// was never finished (completed is false). getModel tells us which path the
// model belongs to, so we jump straight to the review screen (template) or the
// editor (scratch) instead of offering the choice cards again, which would
// dead-end on modelExists.
//
// Back navigation is owned by the dots, so there is no onBack prop here.
export function ModelSetupStep({
  orgId,
  onContinue,
}: {
  orgId: string
  onContinue: () => void
}) {
  const t = useTranslations("dashboard.model")
  const tOnboarding = useTranslations("dashboard.onboarding")
  const tScreens = useTranslations("dashboard.onboarding.screens")
  const createFromTemplate = useMutation(
    api.evaluationModel.model.createModelFromTemplate
  )
  const createEmpty = useMutation(api.evaluationModel.model.createEmptyModel)
  const discardModel = useMutation(api.evaluationModel.model.discardModel)
  // This step only reads modelId/templateKey for the resume decision, but it
  // shares the getModel query cache key with the review/editor screens, so it
  // passes the active locale too.
  const locale = useLocale()
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const [mode, setMode] = useState<Mode>("choice")
  const [choice, setChoice] = useState<Choice>(null)
  const [scratchName, setScratchName] = useState("")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  // Resume: if a model already exists when we are still on the choice screen
  // (a reload mid-setup), jump to the screen the model belongs to. Seed-once
  // during render keyed on the model id so the jump happens exactly once and
  // never fights a later in-session create.
  const [resumedModelId, setResumedModelId] = useState<string | null>(null)
  if (
    mode === "choice" &&
    model !== undefined &&
    model !== null &&
    resumedModelId !== model.modelId
  ) {
    setResumedModelId(model.modelId)
    setMode(model.templateKey !== null ? "template-review" : "scratch-editor")
  }

  // Reverse the template-vs-scratch choice while onboarding is still open.
  // Discards the model (and its children plus stale model.* suggestions) and
  // returns to the choice screen. Resetting resumedModelId clears the seed-once
  // latch so the now-deleted model id cannot re-trigger a jump and a future
  // re-created model (a new id) resumes correctly.
  const changeChoice = async () => {
    setFailed(false)
    try {
      await discardModel({ orgId })
      setResumedModelId(null)
      setChoice(null)
      setMode("choice")
    } catch {
      setFailed(true)
    }
  }

  if (mode === "template-review") {
    return (
      <ModelReview
        orgId={orgId}
        onContinue={onContinue}
        onChangeChoice={changeChoice}
      />
    )
  }
  if (mode === "scratch-editor") {
    return (
      <CriterionEditor
        orgId={orgId}
        onContinue={onContinue}
        onChangeChoice={changeChoice}
      />
    )
  }
  // The choice screen would render now, but the resume decision needs the
  // getModel result first: show the spinner while it is loading.
  if (model === undefined) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={tOnboarding("loading")} />
      </main>
    )
  }

  // Confirm creates the model for the selected path: template creates from the
  // standard template, scratch creates an empty model with the typed name.
  const confirm = async () => {
    setPending(true)
    setFailed(false)
    try {
      if (choice === "template") {
        await createFromTemplate({ orgId })
        setPending(false)
        setMode("template-review")
      } else {
        await createEmpty({ orgId, name: scratchName.trim() })
        setPending(false)
        setMode("scratch-editor")
      }
    } catch {
      setFailed(true)
      setPending(false)
    }
  }

  const confirmDisabled =
    pending ||
    choice === null ||
    (choice === "scratch" && scratchName.trim().length === 0)

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-center font-semibold text-2xl">{t("heading")}</h1>
      <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        <OptionCard
          badge={t("template.badge")}
          title={t("template.title")}
          description={t("template.description")}
          selected={choice === "template"}
          onSelect={() => setChoice("template")}
        />
        <OptionCard
          title={t("scratch.title")}
          description={t("scratch.description")}
          selected={choice === "scratch"}
          onSelect={() => setChoice("scratch")}
        />
      </div>
      {/* The scratch name input lives below the cards, revealed once the scratch
          card is selected (matching the prior in-card input as closely as the
          centered layout allows). */}
      {choice === "scratch" && (
        <div className="w-full max-w-xs space-y-2">
          <Label htmlFor="model-name">{t("scratch.nameLabel")}</Label>
          <Input
            id="model-name"
            value={scratchName}
            onChange={(event) => setScratchName(event.target.value)}
          />
        </div>
      )}
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
      <Button type="button" disabled={confirmDisabled} onClick={confirm}>
        {tScreens("continueCta")}
      </Button>
    </div>
  )
}
