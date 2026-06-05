"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { CriterionEditor } from "@/components/onboarding/criterion-editor"
import { ModelReview } from "@/components/onboarding/model-review"

type Mode = "choice" | "template-review" | "scratch-editor"

// Step 3: the gate keeps the wizard mounted for the whole onboarding session,
// so the choice, review, and editor screens live in LOCAL state after the
// create call. "Finish setup" calls completeOnboarding, then onFinished, which
// hands control to the gate.
//
// Resume: a reload lands here whenever a model already exists but onboarding
// was never finished (completed is false). getModel tells us which path the
// model belongs to, so we jump straight to the review screen (template) or the
// editor (scratch) instead of offering the choice cards again, which would
// dead-end on modelExists.
//
// onBack supports back-navigation from the choice screen AND from the review and
// editor screens. The model is already created on those screens, but returning
// to the profile step (step 2) is harmless: only re-choosing the model would be
// irreversible, and that is not offered on the review/editor screens.
export function ModelSetupStep({
  orgId,
  onFinished,
  onBack,
}: {
  orgId: string
  onFinished: () => void
  onBack?: () => void
}) {
  const t = useTranslations("dashboard.onboarding.model")
  const tOnboarding = useTranslations("dashboard.onboarding")
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
      setMode("choice")
    } catch {
      setFailed(true)
    }
  }

  if (mode === "template-review") {
    return (
      <ModelReview
        orgId={orgId}
        onFinished={onFinished}
        onBack={onBack}
        onChangeChoice={changeChoice}
      />
    )
  }
  if (mode === "scratch-editor") {
    return (
      <CriterionEditor
        orgId={orgId}
        onFinished={onFinished}
        onBack={onBack}
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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-medium text-lg">{t("heading")}</h2>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {/* The recommended card carries a corner badge and a primary border;
            both CTAs sit in bottom-aligned footers so the cards line up. */}
        <Card className="relative flex flex-col overflow-visible border-primary">
          <Badge className="absolute -top-2.5 right-4">
            {t("template.badge")}
          </Badge>
          <CardHeader>
            <CardTitle>{t("template.title")}</CardTitle>
            <CardDescription>{t("template.description")}</CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <Button
              disabled={pending}
              onClick={async () => {
                setPending(true)
                setFailed(false)
                try {
                  await createFromTemplate({ orgId })
                  setPending(false)
                  setMode("template-review")
                } catch {
                  setFailed(true)
                  setPending(false)
                }
              }}
            >
              {t("template.cta")}
            </Button>
          </CardFooter>
        </Card>
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>{t("scratch.title")}</CardTitle>
            <CardDescription>{t("scratch.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="model-name">{t("scratch.nameLabel")}</Label>
              <Input
                id="model-name"
                value={scratchName}
                onChange={(event) => setScratchName(event.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="mt-auto">
            <Button
              variant="outline"
              disabled={pending || scratchName.trim().length === 0}
              onClick={async () => {
                setPending(true)
                setFailed(false)
                try {
                  await createEmpty({ orgId, name: scratchName.trim() })
                  setPending(false)
                  setMode("scratch-editor")
                } catch {
                  setFailed(true)
                  setPending(false)
                }
              }}
            >
              {t("scratch.cta")}
            </Button>
          </CardFooter>
        </Card>
      </div>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
      {/* Back control under the cards (choice screen only). Model creation has
          not happened yet here, so returning to step 2 is safe. */}
      {onBack && (
        <div className="flex">
          <Button type="button" variant="outline" onClick={onBack}>
            {tOnboarding("back")}
          </Button>
        </div>
      )}
    </div>
  )
}
