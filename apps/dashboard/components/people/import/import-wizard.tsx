"use client"

import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { AccountMenu } from "@/components/account-menu"
import { AuthShell } from "@/components/auth/auth-shell"
import { OnboardingDots } from "@/components/onboarding/onboarding-dots"
import { ScreenShell } from "@/components/onboarding/screen-shell"
import { WizardFooter } from "@/components/onboarding/wizard-footer"
import { NextButton } from "@/components/onboarding/next-button"
import { Button } from "@workspace/ui/components/button"
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

  const [state, setState] = useState<WizardState>({
    step: STEP_UPLOAD,
    parsed: null,
    csvText: null,
    mapping: null,
    checkBlocking: null,
    checkIssueCount: 0,
    genderOverrides: {},
    validation: null,
    result: null,
  })

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
              onParsed={(parsed, csvText) =>
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
    <AuthShell
      headerRight={<AccountMenu />}
      contentClassName="max-w-xl"
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
          className="w-full"
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </AuthShell>
  )
}
