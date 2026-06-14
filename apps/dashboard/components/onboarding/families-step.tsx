"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { MAX_STARTER_IMPORT_TEXT } from "@workspace/constants"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Progress } from "@workspace/ui/components/progress"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { AnimatePresence, motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { ConfirmButtons } from "@/components/confirm-buttons"
import { HelpMorphButton } from "@/components/help-morph-button"
import { FamiliesReview } from "@/components/onboarding/families-review"
import { NextButton } from "@/components/onboarding/next-button"
import { ScreenShell } from "@/components/onboarding/screen-shell"
import { TypewriterPlaceholder } from "@/components/onboarding/typewriter-placeholder"
import { WizardFooter } from "@/components/onboarding/wizard-footer"
import { useFamiliesDraftFlow } from "@/hooks/use-families-draft-flow"
import { capitalizeFirst } from "@/lib/capitalize"

// Screen 6: rollfamiljer and roller. The user pastes their own role list
// (the AI groups it into families) or falls back to the industry template;
// either way the result is an editable review list, and nothing is written
// until "create and continue". Both paths create the starter set and advance
// to the score step. All of that orchestration (queries, mutations, the AI
// suggestion lifecycle, the render-phase seed blocks, and the interacting
// flags) lives in useFamiliesDraftFlow; this component is the view over it.
export function FamiliesStep({
  orgId,
  organizationName,
  onAdvance,
}: {
  orgId: string
  organizationName: string
  onAdvance: () => void
}) {
  const t = useTranslations("dashboard.onboarding.families")
  const tHelp = useTranslations("dashboard.help")
  const tReview = useTranslations("dashboard.model.review")
  const tAi = useTranslations("dashboard.ai")
  const tErrors = useTranslations("errors")
  const locale = useLocale()
  const flowState = useFamiliesDraftFlow({ orgId, organizationName, onAdvance })
  const {
    phase,
    reviewModelPending,
    loadingGate,
    draft,
    seededFrom,
    createdViaTemplate,
    restartDestructive,
    trackOptions,
    rawText,
    setRawText,
    starterReady,
    modelReady,
    requestPending,
    requestFailed,
    failure,
    flow,
    pending,
    prefillProgress,
    created,
    restartPending,
    inputValid,
    seedFromTemplate,
    onAnalyze,
    finish,
    restart,
  } = flowState

  // The review list needs the model's tracks for the Select options.
  if (reviewModelPending) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("heading", { name: organizationName })} />
      </main>
    )
  }

  // Hold the spinner until the revisit queries resolve (or a template create is
  // in flight), so a revisit/template-pick never flashes the paste view before
  // the resume-from-existing seed runs. The full reasoning lives on loadingGate
  // in the hook.
  if (loadingGate) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("heading", { name: organizationName })} />
      </main>
    )
  }

  return (
    <ScreenShell
      // A name-first heading starts with the name as typed; heading
      // typography still wants a capital (translators may reorder).
      heading={capitalizeFirst(
        t("heading", { name: organizationName }),
        locale
      )}
      // Brand the company name inside the heading (the derived value).
      highlight={organizationName}
      // No ScreenShell subtitle: the single muted subtitle every phase needs
      // lives inside the phase. The review phase's hint row carries it (the
      // template variant via reviewHintStarter), the paste view is covered by
      // the animated placeholder plus the help popover, and the AI review's
      // line is the provenance paragraph (ADR-0003).
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={phase}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex w-full flex-col items-center gap-6"
        >
          {phase === "prefilling" ? (
            renderPrefillingPhase()
          ) : phase === "review" ? (
            renderReviewPhase()
          ) : phase === "generating" ? (
            <p className="flex items-center gap-2 text-muted-foreground text-sm">
              <Spinner />
              {t("generating")}
            </p>
          ) : (
            renderPastePhase()
          )}
        </motion.div>
      </AnimatePresence>
    </ScreenShell>
  )

  // Plain render helpers, NOT components: a component defined inside the
  // parent gets a new identity every render and would remount the subtree
  // (the textarea would drop focus on every keystroke).
  function renderPastePhase() {
    return (
      <div className="w-full space-y-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="families-import-text">{t("pasteLabel")}</Label>
          <HelpMorphButton label={t("pasteHelpLabel")}>
            {t("pasteHelpBody")}
          </HelpMorphButton>
        </div>
        <div className="relative">
          <Textarea
            id="families-import-text"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            className="min-h-40"
            maxLength={MAX_STARTER_IMPORT_TEXT}
          />
          {rawText === "" && (
            <TypewriterPlaceholder
              phrases={[
                t("placeholderPhrase1"),
                t("placeholderPhrase2"),
                t("placeholderPhrase3"),
              ]}
            />
          )}
        </div>
        <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-sm">
          <span>{t("templateOr")}</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-muted-foreground underline underline-offset-4"
            disabled={!starterReady || !modelReady}
            onClick={seedFromTemplate}
          >
            {t("templateCta")}
          </Button>
        </div>
        <WizardFooter>
          <NextButton
            disabled={requestPending || !inputValid}
            onClick={() => onAnalyze()}
          />
        </WizardFooter>
        {/* Alerts extend below the CTA so nothing on screen reflows. A failed
            template create (which runs on pick) drops back here, so its
            duplicate/generic failure surfaces in the paste view alongside the
            AI-import failures. */}
        {(flow.status === "failed" || requestFailed || failure !== null) && (
          <p role="alert" className="text-destructive text-sm">
            {failure === "duplicate"
              ? tErrors("roleFamilyExists")
              : failure === "generic" || requestFailed
                ? t("error")
                : tErrors(flow.errorSubKey ?? "aiGenerationFailed")}
          </p>
        )}
      </div>
    )
  }

  // The prefill span after persist: a dedicated screen (loader + message +
  // progress bar) inside the same ScreenShell so the heading stays for
  // continuity. Drives off prefillProgress, which climbs reactively as each
  // prefill chunk commits a role's profile. The wizard advances away once the
  // action resolves. Shown only when there were empty profiles to fill, so the
  // template path (every role already complete) never reaches here.
  function renderPrefillingPhase() {
    const { done, total } = prefillProgress
    const percent = total > 0 ? Math.round((done / total) * 100) : 0
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="space-y-1">
          {/* Spinner sits on the same row as the heading, not on a line of its
              own (which read as a stray loose dot above the title). */}
          <p className="flex items-center justify-center gap-2 font-medium text-base">
            <Spinner />
            {t("prefillingHeading")}
          </p>
          <p className="text-muted-foreground text-sm">{t("prefillingBody")}</p>
        </div>
        {/* The drafting bar wears the rose brand accent (override the shared
            Progress indicator at the call site) so this branded onboarding
            moment matches the heading; other progress bars stay neutral. */}
        <Progress
          value={percent}
          className="[&>[data-slot=progress-indicator]]:bg-brand"
        />
        <p className="text-muted-foreground text-sm">
          {t("prefillingProgress", { done, total })}
        </p>
      </div>
    )
  }

  function renderReviewPhase() {
    return (
      <>
        {/* One muted subtitle per review source so the screen never stacks two
            centered lines: the AI review shows its provenance (ADR-0003: review
            and confirm, nothing auto-applied), the just-created template review
            its reassurance, and a genuine revisit the plain grouping hint. The
            help icon flows inline at the end so it trails the last word instead
            of floating when the line wraps. */}
        <p className="text-center text-muted-foreground text-sm">
          {createdViaTemplate
            ? t("reviewHintStarter")
            : seededFrom?.source === "ai"
              ? tAi("provenance")
              : t("reviewHint")}{" "}
          <HelpMorphButton
            label={tHelp("familiesReviewLabel")}
            className="inline-flex align-middle"
          >
            {tHelp("familiesReviewBody")}
          </HelpMorphButton>
        </p>
        <FamiliesReview
          families={draft.families ?? []}
          onFamiliesChange={draft.update}
          claimId={draft.claimId}
          trackOptions={trackOptions}
        />
        {failure !== null && (
          <p role="alert" className="text-destructive text-sm">
            {failure === "duplicate" ? tErrors("roleFamilyExists") : t("error")}
          </p>
        )}
        {/* This step cannot be skipped: emptying the list and finishing is the
            explicit way to start without families. Start over is always shown in
            review, but its weight matches what it does. When a role set is
            persisted (restartDestructive: any "existing" review, a saved revisit
            or the just-created-via-template set), Start over archives those roles
            via reconcile-empty, so it is gated behind a two-step confirm (the
            ConfirmButtons trigger arms a destructive confirm + cancel, zero
            layout shift) before it wipes the set and returns to the paste view.
            When nothing is persisted yet (the AI review created no roles), Start
            over only dismisses the suggestion and returns to the paste view with
            the pasted text intact, so it stays a plain ghost trigger. Either way
            it is disabled once an AI set was confirmed (a retry after a failed
            advance) and while a discard is in flight. */}
        <WizardFooter>
          {restartDestructive ? (
            <ConfirmButtons
              triggerText={t("restartCta")}
              confirmLabel={t("restartConfirm")}
              cancelLabel={t("restartCancel")}
              onConfirm={restart}
              disabled={pending || created || restartPending}
            />
          ) : (
            <Button
              type="button"
              variant="ghost"
              disabled={pending || created || restartPending}
              onClick={restart}
            >
              {t("restartCta")}
            </Button>
          )}
          <Button type="button" disabled={pending} onClick={() => finish()}>
            {(draft.families ?? []).length === 0
              ? tReview("cta")
              : t("nextCta")}
            {/* No in-button spinner: when finish() kicks off the prefill the
                wizard swaps to the dedicated prefilling screen, so the button
                just carries its static forward arrow. */}
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              aria-hidden="true"
            />
          </Button>
        </WizardFooter>
      </>
    )
  }
}
