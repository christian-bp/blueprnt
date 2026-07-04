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
import { UploadStep } from "./upload-step"

// The parsed output from tokenizeCsv that the wizard threads through steps.
export interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

// Wizard flow state. Steps 3-5 (Map, Check, Review) are placeholders that will
// be filled in by Tasks 3-5.
interface WizardState {
  step: number
  parsed: ParsedCsv | null
  mapping: Record<string, number> | null
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
    mapping: null,
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
      // Placeholder steps: always allow advancing.
      case STEP_MAP:
      case STEP_CHECK:
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
              onParsed={(parsed) => setState((prev) => ({ ...prev, parsed }))}
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
          <ScreenShell heading={t("steps.map")}>
            {/* Placeholder: replaced by Task 3 */}
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
          <ScreenShell heading={t("steps.check")}>
            {/* Placeholder: replaced by Task 4 */}
            <WizardFooter>
              <Button variant="outline" onClick={goBack}>
                {t("back")}
              </Button>
              <NextButton label={t("next")} onClick={advance} />
            </WizardFooter>
          </ScreenShell>
        )
      case STEP_REVIEW:
        return (
          <ScreenShell heading={t("steps.review")}>
            {/* Placeholder: replaced by Task 5 */}
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
