"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { MAX_FAMILIES, MAX_ROLES } from "@workspace/constants"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { AnimatePresence, motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { ConfirmButtons } from "@/components/confirm-buttons"
import { HelpMorphButton } from "@/components/help-morph-button"
import { FamilyReviewTable } from "@/components/family-review-table"
import { NextButton } from "@/components/next-button"
import { PastedRolesField } from "@/components/pasted-roles-field"
import { ScreenShell } from "@/components/screen-shell"
import { WizardFooter } from "@/components/wizard-footer"
import { WizardProgress } from "@/components/wizard-progress"
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
    importTruncated,
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
      // Left-aligned, unlike the pick-a-card screens before it: this is the
      // only onboarding step whose content is a form, and a long centered
      // question over a left-aligned label and field reads ragged. Only the
      // heading moves; each phase still aligns its own content.
      align="start"
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
        {/* No subtitle here (the review and prefill phases carry their own):
            the heading is a question, so it already says what this screen wants,
            and a paragraph repeating it read as a wall of text above the field. */}
        <PastedRolesField
          id="families-import-text"
          value={rawText}
          onChange={setRawText}
          label={t("pasteLabel")}
          helpLabel={t("pasteHelpLabel")}
          helpBody={t("pasteHelpBody")}
          hint={t("pasteHint")}
          placeholderPhrases={[
            t("placeholderPhrase1"),
            t("placeholderPhrase2"),
            t("placeholderPhrase3"),
          ]}
        />
        {/* The template CTA is the other way to leave this screen, so it sits
            in the footer immediately left of Next as the outline secondary to
            its primary (the footer convention), and carries the same forward
            arrow with the same hover nudge: two ways forward, one visual
            language. */}
        <WizardFooter>
          <Button
            type="button"
            variant="outline"
            className="group/template"
            disabled={!starterReady || !modelReady}
            onClick={seedFromTemplate}
          >
            {t("templateCta")}
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              aria-hidden="true"
              className="transition-transform group-hover/template:translate-x-0.5 group-focus-visible/template:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover/template:translate-x-0"
            />
          </Button>
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
    return (
      <WizardProgress
        className="max-w-md"
        done={done}
        total={total}
        label={t("prefillingHeading")}
        heading
        description={t("prefillingBody")}
        countLabel={t("prefillingProgress", { done, total })}
        accent
      />
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
        {/* The AI grouping was clamped to the import's caps, so the list below
            is shorter than what was pasted. Said here because the review shows
            only the survivors: without it the missing roles are discovered
            much later, in the register. */}
        {importTruncated && (
          <Alert>
            <AlertDescription>
              {t("importTruncated", {
                roles: MAX_ROLES,
                families: MAX_FAMILIES,
              })}
            </AlertDescription>
          </Alert>
        )}
        {/* The same table the in-app role import reviews its proposal in.
            No register and no annotations: onboarding builds the starter set
            for an org that has none yet, so every row is one this step would
            create and is editable and removable. */}
        <FamilyReviewTable
          families={draft.families ?? []}
          onFamiliesChange={draft.update}
          claimId={draft.claimId}
          trackOptions={trackOptions}
        />
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
        {/* Alert below the CTA so nothing on screen reflows (matches the paste
            view). A failed finish/family create surfaces here. */}
        {failure !== null && (
          <p role="alert" className="text-destructive text-sm">
            {failure === "duplicate" ? tErrors("roleFamilyExists") : t("error")}
          </p>
        )}
      </>
    )
  }
}
