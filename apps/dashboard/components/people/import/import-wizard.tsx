"use client"

import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { PayBasis } from "@workspace/import"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { OnboardingDots } from "@/components/onboarding/onboarding-dots"
import { SuccessCheck } from "@/components/success-check"
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
import { ImportDoneStep } from "./import-done-step"
import { ImportingStep } from "./importing-step"
import { MapStep } from "./map-step"
import { ReviewStep } from "./review-step"
import { UploadStep } from "./upload-step"

// The parsed output from tokenizeCsv that the wizard threads through steps.
export interface ParsedCsv {
  headers: string[]
  rows: string[][]
  /** The file has no header row: headers are synthesized ("column_1", ...). */
  headerless: boolean
}

// What a successful import did, shown on the final done screen.
export interface ImportResultCounts {
  created: number
  updated: number
  // Existing people whose incoming data matched what is already stored.
  unchanged: number
  skipped: number
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
  // Monthly/annual basis per mapped money field key, seeded by MapStep.
  basisMap: Record<string, PayBasis>
  // Whether the check step has reported the import as blocked (missing
  // required fields, hard data errors, or unassigned genders).
  // null = not yet validated (check step not yet reached).
  checkBlocking: boolean | null
  // Per-row manual gender assignments collected on the check step,
  // keyed by trimmed externalRef. Forwarded to importPayroll as genderOverrides.
  genderOverrides: Record<string, "Man" | "Kvinna">
  // Armed by the check step's fix-and-reupload shortcut: after the corrected
  // file parses (with unchanged headers), the wizard returns straight to the
  // check step so the fresh validation is visible immediately.
  returnToCheck: boolean
  // Non-null while the import action runs: the importing screen replaces
  // the review step until it succeeds (done screen) or fails (returns to
  // review). The value identifies the run in the importProgress table.
  importingId: string | null
  // Blocking field keys from a failed import attempt (backend re-validation).
  importBlocking: string[] | null
  // Set when the import succeeded: the done screen shows these counts.
  importResult: ImportResultCounts | null
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
    basisMap: {},
    checkBlocking: null,
    genderOverrides: {},
    returnToCheck: false,
    importingId: null,
    importBlocking: null,
    importResult: null,
  })

  const [discardOpen, setDiscardOpen] = useState(false)

  // The step whose content is currently visible. It lags state.step until the
  // outgoing step's exit fade finishes (onExitComplete), so the shell's
  // scroll-to-top (keyed on this) runs in the blank moment between steps,
  // never while the old step is still on screen.
  const [displayedStep, setDisplayedStep] = useState(STEP_UPLOAD)

  // A file has been uploaded/parsed and the import has not yet completed.
  // Nothing is persisted to the DB until the final Import action, so leaving
  // is a clean discard, but we warn the user first when there is progress.
  // After a successful import (done screen) leaving is free again.
  const hasProgress = state.parsed !== null && state.importResult === null

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
    // After a successful import: the done screen with the result counts.
    // The celebratory check sits ABOVE the heading (same as the 2FA and
    // change-email completion screens).
    if (state.importResult !== null) {
      return (
        <div className="flex w-full flex-col gap-6">
          <div className="flex justify-center">
            <SuccessCheck />
          </div>
          <ScreenShell
            heading={t("done.title")}
            description={t("done.description")}
          >
            <ImportDoneStep result={state.importResult} />
          </ScreenShell>
        </div>
      )
    }
    // The importing screen replaces the review step while the action runs.
    if (state.importingId !== null) {
      return (
        <ScreenShell
          heading={t("importing.title")}
          description={t("importing.description")}
        >
          <ImportingStep importId={state.importingId} />
        </ScreenShell>
      )
    }
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
                    // Came here via fix-and-reupload and the mapping still
                    // applies (headers unchanged): jump straight back to the
                    // check step so the re-test is visible immediately. A
                    // changed-headers file needs the map step first.
                    step:
                      prev.returnToCheck && !headersChanged
                        ? STEP_CHECK
                        : prev.step,
                    returnToCheck: false,
                    ...(headersChanged
                      ? {
                          mapping: null,
                          basisMap: {},
                          checkBlocking: null,
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
                  basisMap: {},
                  checkBlocking: null,
                  genderOverrides: {},
                  returnToCheck: false,
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
                basisMap={state.basisMap}
                onBasisChange={(basisMap) =>
                  setState((prev) => ({ ...prev, basisMap }))
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
                    setState((prev) => ({
                      ...prev,
                      step: STEP_UPLOAD,
                      returnToCheck: true,
                    }))
                  }
                  genderOverrides={state.genderOverrides}
                  onGenderOverridesChange={(genderOverrides) =>
                    setState((prev) => ({ ...prev, genderOverrides }))
                  }
                  onValidated={(isBlocking) =>
                    setState((prev) => ({
                      ...prev,
                      checkBlocking: isBlocking,
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
                  basisMap={state.basisMap}
                  genderOverrides={state.genderOverrides}
                  onBack={goBack}
                  blockingError={state.importBlocking}
                  onImportStart={(importId) =>
                    setState((prev) => ({
                      ...prev,
                      importingId: importId,
                      importBlocking: null,
                    }))
                  }
                  onImportEnd={(blocking) =>
                    setState((prev) => ({
                      ...prev,
                      importingId: null,
                      importBlocking: blocking ?? null,
                    }))
                  }
                  onImportSuccess={(result) =>
                    setState((prev) => ({
                      ...prev,
                      importingId: null,
                      importResult: result,
                    }))
                  }
                />
              )}
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
        contentKey={displayedStep}
        footer={
          <OnboardingDots
            steps={steps}
            activeIndex={state.step}
            maxReachedIndex={state.step}
            navLabel={t("navLabel")}
            onSelect={(index) => {
              // No navigation while the import runs or after it completed.
              if (state.importingId !== null || state.importResult !== null)
                return
              if (index < state.step) {
                setState((prev) => ({ ...prev, step: index }))
              }
            }}
          />
        }
      >
        {/* Step crossfade: old screen fades out before new one fades in.
            initial={false} prevents the first screen from fading on page load. */}
        <AnimatePresence
          mode="wait"
          initial={false}
          onExitComplete={() => setDisplayedStep(state.step)}
        >
          <motion.div
            key={
              state.importResult !== null
                ? "done"
                : state.importingId !== null
                  ? "importing"
                  : `step-${state.step}`
            }
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
