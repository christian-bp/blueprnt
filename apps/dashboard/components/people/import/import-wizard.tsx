"use client"

import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { OnboardingDots } from "@/components/onboarding/onboarding-dots"
import { ScreenShell } from "@/components/onboarding/screen-shell"
import { WizardFooter } from "@/components/onboarding/wizard-footer"
import { NextButton } from "@/components/onboarding/next-button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { WizardShell } from "@/components/wizard-shell"
import { CheckStep } from "./check-step"
import { MapStep } from "./map-step"
import { ReviewStep } from "./review-step"
import { UploadStep } from "./upload-step"

// The parsed output from tokenizeCsv that the wizard threads through steps.
export interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

// Wizard flow state.
interface WizardState {
  step: number
  parsed: ParsedCsv | null
  // Raw CSV text retained so the importPayroll action can receive it.
  csvText: string | null
  // Name and size of the uploaded file, shown in the upload file card.
  fileName: string | null
  fileSize: number | null
  mapping: Record<string, number> | null
  // Whether the check step has reported blocking required fields.
  // null = not yet validated (check step not yet reached).
  checkBlocking: boolean | null
  // Number of per-row data-quality issues from the check step (used by ReviewStep).
  checkIssueCount: number
  // Per-row manual gender assignments collected on the check step,
  // keyed by trimmed externalRef. Forwarded to importPayroll as genderOverrides.
  genderOverrides: Record<string, "Man" | "Kvinna">
  validation: unknown | null
  result: unknown | null
}

const STEP_COUNT = 4

// Step index constants for clarity.
const STEP_UPLOAD = 0
const STEP_MAP = 1
const STEP_CHECK = 2
const STEP_REVIEW = 3

export function ImportWizard() {
  const t = useTranslations("dashboard.people.import")
  // Full-screen takeover hides the shell nav, so the wizard carries its own exit
  // back to the People list. Reuse the existing people.detail "back to people"
  // label rather than duplicate the string.
  const tDetail = useTranslations("dashboard.people.detail")
  const router = useRouter()

  const [state, setState] = useState<WizardState>({
    step: STEP_UPLOAD,
    parsed: null,
    csvText: null,
    fileName: null,
    fileSize: null,
    mapping: null,
    checkBlocking: null,
    checkIssueCount: 0,
    genderOverrides: {},
    validation: null,
    result: null,
  })

  const [discardOpen, setDiscardOpen] = useState(false)

  // A file has been uploaded/parsed and the import has not yet completed.
  // Nothing is persisted to the DB until the final Import action, so leaving
  // is a clean discard, but we warn the user first when there is progress.
  const hasProgress = state.parsed !== null && state.result === null

  // Guard reload/close/tab-close with the browser's native beforeunload prompt.
  // Note: in-app browser Back is not interceptable in the App Router; this covers
  // reload/close and the explicit exit button below.
  useEffect(() => {
    if (!hasProgress) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => {
      window.removeEventListener("beforeunload", handler)
    }
  }, [hasProgress])

  const stepKeys = [
    "steps.upload",
    "steps.map",
    "steps.check",
    "steps.review",
  ] as const

  const steps = stepKeys.map((key, index) => ({
    key: `step-${index}`,
    label: t(key),
  }))

  function advance() {
    setState((prev) => ({
      ...prev,
      step: Math.min(prev.step + 1, STEP_COUNT - 1),
    }))
  }

  function goBack() {
    setState((prev) => ({ ...prev, step: Math.max(prev.step - 1, 0) }))
  }

  // Whether the current step permits advancing to the next.
  const canAdvance: boolean = (() => {
    switch (state.step) {
      case STEP_UPLOAD:
        return state.parsed !== null
      case STEP_MAP:
        return true
      case STEP_CHECK:
        // Block advancing when validation has detected missing required fields.
        // null means validation has not yet run (should not happen in practice
        // since CheckStep runs validateImport on mount).
        return state.checkBlocking === false
      case STEP_REVIEW:
        return true
      default:
        return false
    }
  })()

  function renderStep() {
    switch (state.step) {
      case STEP_UPLOAD:
        return (
          <ScreenShell
            heading={t("upload.heading")}
            description={t("upload.description")}
          >
            <UploadStep
              parsed={state.parsed}
              fileName={state.fileName}
              fileSize={state.fileSize}
              onParsed={(parsed, csvText, file) =>
                setState((prev) => {
                  // Detect whether the new file has different headers.
                  // If headers changed, the old column-index mapping is stale
                  // and must be discarded so MapStep re-seeds for the new file.
                  const headersChanged =
                    prev.parsed === null ||
                    prev.parsed.headers.length !== parsed.headers.length ||
                    prev.parsed.headers.some((h, i) => h !== parsed.headers[i])
                  return {
                    ...prev,
                    parsed,
                    csvText,
                    fileName: file.name,
                    fileSize: file.size,
                    ...(headersChanged
                      ? {
                          mapping: null,
                          checkBlocking: null,
                          checkIssueCount: 0,
                          genderOverrides: {},
                        }
                      : {}),
                  }
                })
              }
              onClear={() =>
                setState((prev) => ({
                  ...prev,
                  parsed: null,
                  csvText: null,
                  fileName: null,
                  fileSize: null,
                  mapping: null,
                  checkBlocking: null,
                  checkIssueCount: 0,
                  genderOverrides: {},
                }))
              }
            />
            <WizardFooter>
              {state.step > 0 && (
                <Button variant="outline" onClick={goBack}>
                  {t("back")}
                </Button>
              )}
              <NextButton
                label={t("next")}
                disabled={!canAdvance}
                onClick={advance}
              />
            </WizardFooter>
          </ScreenShell>
        )
      case STEP_MAP:
        return (
          <ScreenShell heading={t("map.title")}>
            {state.parsed !== null && (
              <MapStep
                parsed={state.parsed}
                mapping={state.mapping}
                onMappingChange={(mapping) =>
                  setState((prev) => ({ ...prev, mapping }))
                }
              />
            )}
            <WizardFooter>
              <Button variant="outline" onClick={goBack}>
                {t("back")}
              </Button>
              <NextButton label={t("next")} onClick={advance} />
            </WizardFooter>
          </ScreenShell>
        )
      case STEP_CHECK:
        return (
          <ScreenShell
            heading={t("check.title")}
            description={t("check.description")}
          >
            {state.parsed !== null &&
              state.mapping !== null &&
              state.csvText !== null && (
                <CheckStep
                  parsed={state.parsed}
                  mapping={state.mapping}
                  csvText={state.csvText}
                  onReupload={() =>
                    setState((prev) => ({ ...prev, step: STEP_UPLOAD }))
                  }
                  genderOverrides={state.genderOverrides}
                  onGenderOverridesChange={(genderOverrides) =>
                    setState((prev) => ({ ...prev, genderOverrides }))
                  }
                  onValidated={(isBlocking, issueCount) =>
                    setState((prev) => ({
                      ...prev,
                      checkBlocking: isBlocking,
                      checkIssueCount: issueCount,
                    }))
                  }
                />
              )}
            <WizardFooter>
              <Button variant="outline" onClick={goBack}>
                {t("back")}
              </Button>
              <NextButton
                label={t("next")}
                disabled={!canAdvance}
                onClick={advance}
              />
            </WizardFooter>
          </ScreenShell>
        )
      case STEP_REVIEW:
        return (
          <ScreenShell
            heading={t("review.title")}
            description={t("review.description")}
          >
            {state.parsed !== null &&
              state.mapping !== null &&
              state.csvText !== null && (
                <ReviewStep
                  parsed={state.parsed}
                  mapping={state.mapping}
                  csvText={state.csvText}
                  flaggedCount={state.checkIssueCount}
                  genderOverrides={state.genderOverrides}
                />
              )}
            <WizardFooter>
              <Button variant="outline" onClick={goBack}>
                {t("back")}
              </Button>
            </WizardFooter>
          </ScreenShell>
        )
      default:
        return null
    }
  }

  return (
    <>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("discard.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("discard.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("discard.keep")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/people")}>
              {t("discard.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <WizardShell
        headerLeft={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (hasProgress) {
                setDiscardOpen(true)
              } else {
                router.push("/people")
              }
            }}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            {tDetail("backToPeople")}
          </Button>
        }
        // The shell stays at the widest step's width; each step carries its
        // own max-width inside the crossfade below. Putting the width on the
        // shell instead would resize the OUTGOING screen the moment the step
        // changes, while it is still visible mid-fade (a layout shift).
        contentClassName="max-w-5xl"
        footer={
          <OnboardingDots
            steps={steps}
            activeIndex={state.step}
            maxReachedIndex={state.step}
            navLabel={t("navLabel")}
            onSelect={(index) => {
              if (index < state.step) {
                setState((prev) => ({ ...prev, step: index }))
              }
            }}
          />
        }
      >
        {/* Step crossfade: old screen fades out before new one fades in.
            initial={false} prevents the first screen from fading on page load. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`step-${state.step}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            // Per-step width: the map step's table uses the full 5xl shell;
            // the other steps keep a centered reading column. The class lives
            // on the crossfading element, so an exiting screen keeps its own
            // width while it fades.
            className={cn(
              "w-full",
              state.step !== STEP_MAP && "mx-auto max-w-2xl"
            )}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </WizardShell>
    </>
  )
}
