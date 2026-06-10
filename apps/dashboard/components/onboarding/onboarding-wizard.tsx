"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { OnboardingDots } from "@/components/onboarding/onboarding-dots"
import { CountryScreen } from "@/components/onboarding/country-screen"
import { FamiliesStep } from "@/components/onboarding/families-step"
import { IndustryScreen } from "@/components/onboarding/industry-screen"
import { ModelSetupStep } from "@/components/onboarding/model-setup-step"
import { NameScreen } from "@/components/onboarding/name-screen"
import { OnboardingHeader } from "@/components/onboarding/onboarding-header"

export interface OnboardingStatus {
  organization: { orgId: string; name: string; role: string } | null
  settingsComplete: boolean
  hasModel: boolean
  completed: boolean
}

// The slice of the persisted settings the resume logic reads.
interface SettingsSlice {
  country?: string | null
  currency?: string | null
  industry?: string | null
}

// Everything a step's render needs from the wizard.
interface StepContext {
  status: OnboardingStatus
  orgId: string | null
  settings: SettingsSlice | null | undefined
  // Standard forward move: acknowledges the next screen.
  advance: () => void
  // The model step's continue: additionally raises the session latch so the
  // families step (which is never server-complete) becomes reachable.
  latchNext: () => void
  // The last step's exit: hands control back to the onboarding gate.
  finish: () => void
}

// The wizard's single source of truth: order, dot labels, server-derived
// completion (the resume index is the first incomplete step), and rendering.
// Adding a step means adding ONE entry here.
const STEPS = [
  {
    key: "name",
    dotLabelKey: "dots.name",
    isComplete: (status: OnboardingStatus) => status.organization !== null,
    render: (ctx: StepContext) => (
      <NameScreen
        existing={
          ctx.status.organization === null
            ? null
            : {
                orgId: ctx.status.organization.orgId,
                name: ctx.status.organization.name,
              }
        }
        onAdvance={ctx.advance}
      />
    ),
  },
  {
    key: "country",
    dotLabelKey: "dots.country",
    isComplete: (_status: OnboardingStatus, settings: SettingsSlice) =>
      Boolean(settings.country && settings.currency),
    render: (ctx: StepContext) =>
      ctx.orgId === null ? null : (
        <CountryScreen
          orgId={ctx.orgId}
          savedCountry={ctx.settings?.country ?? null}
          onAdvance={ctx.advance}
        />
      ),
  },
  {
    key: "industry",
    dotLabelKey: "dots.industry",
    isComplete: (_status: OnboardingStatus, settings: SettingsSlice) =>
      Boolean(settings.industry),
    render: (ctx: StepContext) =>
      ctx.orgId === null ? null : (
        <IndustryScreen
          orgId={ctx.orgId}
          saved={ctx.settings?.industry ?? null}
          onAdvance={ctx.advance}
        />
      ),
  },
  {
    key: "model",
    dotLabelKey: "dots.model",
    // Never server-complete: the model screen owns its internal choice ->
    // review sub-flow, and families is reached only via its continue (the
    // session latch), so a reload mid-flow resumes at the model review.
    isComplete: () => false,
    render: (ctx: StepContext) =>
      ctx.status.organization === null ? null : (
        <ModelSetupStep
          orgId={ctx.status.organization.orgId}
          organizationName={ctx.status.organization.name}
          onAdvance={ctx.latchNext}
        />
      ),
  },
  {
    key: "families",
    dotLabelKey: "dots.families",
    isComplete: () => false,
    render: (ctx: StepContext) =>
      ctx.status.organization === null ? null : (
        <FamiliesStep
          orgId={ctx.status.organization.orgId}
          organizationName={ctx.status.organization.name}
          onAdvance={ctx.finish}
        />
      ),
  },
] as const satisfies readonly {
  key: string
  dotLabelKey: `dots.${string}`
  isComplete: (status: OnboardingStatus, settings: SettingsSlice) => boolean
  render: (ctx: StepContext) => ReactNode
}[]

export function OnboardingWizard({
  status,
  onFinished,
}: {
  status: OnboardingStatus
  onFinished: () => void
}) {
  const t = useTranslations("dashboard.onboarding")
  const orgId = status.organization?.orgId ?? null
  // Settings drive the per-field resume; skipped while no org exists.
  const settings = useQuery(
    api.accounts.organization.getOrganizationSettings,
    orgId !== null ? { orgId } : "skip"
  )

  // Session-local forward progress past the model review (no persisted flag:
  // a reload resumes at the review, whose continue is an idempotent no-op).
  const [sessionStep, setSessionStep] = useState<number | null>(null)
  // Back-navigation from the dots; cleared when a revisited screen saves.
  const [backTo, setBackTo] = useState<number | null>(null)
  // The highest screen index the UI may show. Settings save reactively the
  // moment a choice persists, which moves the derived resume index BEFORE
  // the choice screen's fade-and-pause has played; without this cap the
  // wizard would yank the screen away instantly. Screens raise it through
  // advance() (and forward dot clicks); it seeds once from the first
  // resolved resume index so a reload still lands on the frontier.
  const [acked, setAcked] = useState<number | null>(null)

  // Server-derived resume index: the first step whose isComplete is false.
  // Language is never a step: the organization's language derives from the
  // country pick, so it never gates the resume.
  function resumeIndex(): number {
    if (status.organization === null) return 0
    if (settings === undefined) return -1 // settings still loading
    const slice: SettingsSlice = settings ?? {}
    const index = STEPS.findIndex((step) => !step.isComplete(status, slice))
    return index === -1 ? STEPS.length - 1 : index
  }
  const derived = resumeIndex()
  // Seed-once during render (adjust-state-during-render: the guard is false
  // on the next pass), only after settings have resolved.
  if (acked === null && derived !== -1) {
    setAcked(derived)
  }
  // The session latch only counts while the model still exists: discarding
  // the model from a revisited model step retracts the families dot, which
  // would otherwise stay reachable and dead-end on its loading spinner.
  const frontier = Math.max(
    derived,
    sessionStep !== null && status.hasModel ? sessionStep : 0
  )
  const current =
    backTo !== null && backTo < frontier
      ? backTo
      : Math.min(frontier, acked ?? Math.max(derived, 0))

  // Members who are not admins cannot run setup mutations; tell them to wait.
  if (status.organization !== null && status.organization.role !== "admin") {
    return (
      <>
        <OnboardingHeader />
        <main className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center p-6">
          <p className="text-muted-foreground">{t("waitingForAdmin")}</p>
        </main>
      </>
    )
  }

  if (derived === -1) {
    return (
      <>
        <OnboardingHeader />
        <main className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center p-6">
          <Spinner aria-label={t("loading")} />
        </main>
      </>
    )
  }

  const step = STEPS[current] ?? STEPS[0]
  // Completing a screen moves one step forward and acknowledges the move
  // (see acked above). On a revisited screen (backTo set) it walks to the
  // NEXT screen, not back to the frontier, so the user retraces the flow
  // step by step. Reaching the frontier clears the back-state.
  const advance = () => {
    setBackTo((prev) =>
      prev !== null && prev + 1 < frontier ? prev + 1 : null
    )
    setAcked((prev) => Math.max(prev ?? 0, current + 1))
  }
  const ctx: StepContext = {
    status,
    orgId,
    settings,
    advance,
    latchNext: () => {
      const next = current + 1
      setSessionStep(next)
      setBackTo(null)
      setAcked((prev) => Math.max(prev ?? 0, next))
    },
    finish: onFinished,
  }

  return (
    <>
      <OnboardingHeader />
      <main className="flex min-h-[calc(100svh-3.5rem)] flex-col">
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-2xl p-6 md:p-10">
            {/* Step crossfade (the polyform onboarding pattern): the old
                screen fades out before the new one fades in. initial={false}
                keeps the very first screen from fading on page load; its
                heading still plays the TextEffect reveal. */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {step.render(ctx)}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <div className="pb-8">
          <OnboardingDots
            steps={STEPS.map(({ key, dotLabelKey }) => ({
              key,
              label: t(dotLabelKey),
            }))}
            activeIndex={current}
            maxReachedIndex={frontier}
            navLabel={t("dots.navLabel")}
            onSelect={(index) => {
              setBackTo(index < frontier ? index : null)
              // A forward dot click is also an acknowledgement (the dots
              // only offer indices up to the frontier).
              setAcked((prev) => Math.max(prev ?? 0, index))
            }}
          />
        </div>
      </main>
    </>
  )
}
