"use client"

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { MAX_FAMILIES, MAX_ROLES } from "@workspace/constants"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
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
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useOrganization } from "@/components/org-context"
import { PastedRolesField } from "@/components/pasted-roles-field"
import { FamilyReviewTable } from "@/components/family-review-table"
import { ScreenShell } from "@/components/screen-shell"
import { SubmitButton } from "@/components/submit-button"
import NumberFlow from "@number-flow/react"
import { SuccessCheck } from "@/components/success-check"
import { WizardDots } from "@/components/wizard-dots"
import { WizardFooter } from "@/components/wizard-footer"
import { WizardProgress } from "@/components/wizard-progress"
import { WizardShell } from "@/components/wizard-shell"
import { useLaggedContentKey } from "@/hooks/use-lagged-content-key"
import {
  type RoleImportPhase,
  useRoleImportFlow,
} from "@/hooks/use-role-import-flow"

// The in-app role import: paste a list, review what the AI proposes against the
// register you already have, create. A full-screen takeover like the people
// import, because the review needs the width and the flow owns the screen.
export function RoleImportWizard() {
  const t = useTranslations("dashboard.roles.import")
  const tDetail = useTranslations("dashboard.roles.detail")
  const tErrors = useTranslations("errors")
  const router = useRouter()
  const { orgId } = useOrganization()
  const flow = useRoleImportFlow({ orgId })

  const [discardOpen, setDiscardOpen] = useState(false)
  // The SCREEN, not the phase: paste and generating render the same screen and
  // differ only in whether the field is disabled, so keying the crossfade on
  // the phase faded that screen out and back in against itself (the heading
  // blinked the moment the generation started). Every other phase is its own
  // screen, so the key is the phase there.
  const screen: Exclude<RoleImportPhase, "generating"> =
    flow.phase === "generating" ? "paste" : flow.phase
  const { displayedKey, onExitComplete } = useLaggedContentKey(screen)

  // Nothing is written until Create, so leaving is a clean discard, but a
  // reviewed list represents real work: warn before dropping it. Once the
  // import has completed, leaving is free again.
  const hasProgress = flow.phase === "review" && flow.result === null

  // Covers reload and tab close. In-app browser Back is not interceptable in
  // the App Router; the exit control below covers the deliberate case.
  useEffect(() => {
    if (!hasProgress) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => {
      window.removeEventListener("beforeunload", handler)
    }
  }, [hasProgress])

  const steps = [
    { key: "step-0", label: t("steps.paste") },
    { key: "step-1", label: t("steps.review") },
  ]
  const stepIndex =
    flow.phase === "review" ||
    flow.phase === "prefilling" ||
    flow.phase === "done"
      ? 1
      : 0

  function leave() {
    if (hasProgress) {
      setDiscardOpen(true)
      return
    }
    router.push("/roles")
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
            <AlertDialogAction
              onClick={() => {
                // Dismiss here rather than leaving it for the next visit's
                // entry sweep: the user is answering "discard this import?",
                // so the proposal is closed now, while the answer is theirs.
                // restart() runs the same reject flow Start over uses,
                // fire-and-forget like dismiss() already is, so navigation is
                // never blocked on the round trip.
                flow.restart()
                router.push("/roles")
              }}
            >
              {t("discard.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <WizardShell
        headerLeft={
          // Disabled while the confirm is on the wire: once the mutation is
          // sent there is no honest answer to "discard this import?", and
          // navigating away would promise nothing was created while the roles
          // are being created.
          <Button
            variant="ghost"
            size="sm"
            disabled={flow.pending}
            onClick={leave}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            {tDetail("backToRoles")}
          </Button>
        }
        // The shell stays at the widest step's width; each step carries its own
        // max-width inside the crossfade below. Putting the width on the shell
        // instead would resize the OUTGOING screen the moment the phase
        // changes, while it is still visible mid-fade (a layout shift).
        contentClassName="max-w-5xl"
        contentKey={displayedKey}
        footer={
          <WizardDots
            steps={steps}
            activeIndex={stepIndex}
            maxReachedIndex={stepIndex}
            navLabel={t("navLabel")}
            // A pure progress indicator: no dot is ever clickable here. Going
            // back from the review means dropping the proposal server-side and
            // losing the edited list, which is destructive enough to need a
            // labelled control that says so (Start over, and the discard
            // confirmation on the way out). A dot whose only accessible name is
            // its step label must never be able to do that.
            interactive={false}
            onSelect={() => {}}
          />
        }
      >
        <AnimatePresence
          mode="wait"
          initial={false}
          onExitComplete={onExitComplete}
        >
          <motion.div
            key={screen}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            // Per-phase width: only the review takes the full shell, because
            // only it puts the whole register on screen as a four-column
            // table with a field and a select in every row. Everything else is
            // reading material (a paste field, a wait, a three-row summary) and
            // keeps the column it has always had; the done screen in
            // particular would look marooned in a wide frame. The class lives
            // on the crossfading element, so an exiting screen keeps its own
            // width while it fades.
            className={cn(
              "w-full",
              flow.phase !== "review" && "mx-auto max-w-3xl"
            )}
          >
            {renderPhase()}
          </motion.div>
        </AnimatePresence>
      </WizardShell>
    </>
  )

  // Plain render helpers, NOT components: a component defined inside the parent
  // gets a new identity every render and would remount the subtree (the
  // textarea would drop focus on every keystroke).
  function renderPhase() {
    if (flow.phase === "done") return renderDone()
    if (flow.phase === "prefilling") return renderPrefilling()
    if (flow.phase === "review") return renderReview()
    // The wait for the AI is the paste screen, not a screen of its own: the
    // same heading, field and hint (disabled), with the CTA in its own
    // submitting state instead of a bare spinner, so the content box is the
    // same height before and after and nothing rides up or down when the
    // generation starts or lands.
    return renderPaste({ holding: flow.phase === "generating" })
  }

  function renderPaste({ holding }: { holding: boolean }) {
    const { pasted } = flow
    return (
      <ScreenShell heading={t("paste.heading")} align="start">
        <PastedRolesField
          id="role-import-text"
          value={pasted.rawText}
          onChange={pasted.setRawText}
          label={t("paste.label")}
          helpLabel={t("paste.helpLabel")}
          helpBody={t("paste.helpBody")}
          hint={t("paste.hint")}
          placeholderPhrases={[
            t("paste.placeholder1"),
            t("paste.placeholder2"),
          ]}
          // Inert while the generation runs: a request is already in flight
          // and there is nothing left to submit, so interacting is not the
          // harmless no-op an idle control usually is. Visible but disabled
          // rather than swapped out, so the screen keeps its height.
          disabled={holding}
        />
        <WizardFooter>
          {/* The CTA stays in place and shows its own submitting state while
              the generation runs, rather than being replaced by a status
              line: the paste and generating screens then differ only by this
              button's state and the field's disabled attribute above. */}
          <SubmitButton
            type="button"
            isSubmitting={holding}
            disabled={pasted.requestPending || !pasted.inputValid}
            onClick={() => pasted.analyze()}
          >
            {t("paste.cta")}
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              aria-hidden="true"
            />
          </SubmitButton>
        </WizardFooter>
        {/* Alerts extend below the CTA so nothing on screen reflows. Only
            reachable outside the hold: a round trip that fails keeps the
            phase at "paste" rather than "generating", so these flags are
            never true while holding. The failure has to be THIS visit's
            (ownStatus): a failed row from a previous visit is dismissed on
            entry, and its error must not greet a fresh paste screen. */}
        {!holding &&
          (pasted.requestFailed || pasted.ownStatus === "failed") && (
            <p role="alert" className="text-destructive text-sm">
              {pasted.requestFailed
                ? t("paste.error")
                : tErrors(pasted.flow.errorSubKey ?? "aiGenerationFailed")}
            </p>
          )}
      </ScreenShell>
    )
  }

  function renderReview() {
    const { pasted, resolved, annotations, register } = flow
    return (
      <ScreenShell
        heading={t("review.heading")}
        align="start"
        // No help control here. The domain terms it defined (role family,
        // track) are now defined on the paste screen one step earlier, which
        // is where the flow first uses them. The two mechanics it also
        // carried are no longer worth a popover: the table shows a muted
        // static row beside an editable one, and a text name beside a field,
        // so what the faded rows are and which families can be renamed are
        // both visible on sight rather than needing to be described.
      >
        {/* The generation clamps an oversized paste to the import's caps. That
            has to be said here: the review shows only the survivors, so the
            list looks complete and the done screen would report the clamped
            number as the whole job. */}
        {pasted.truncated && (
          <Alert>
            <AlertDescription>
              {t("review.truncated", {
                roles: MAX_ROLES,
                families: MAX_FAMILIES,
              })}
            </AlertDescription>
          </Alert>
        )}
        <FamilyReviewTable
          families={pasted.draft.families ?? []}
          onFamiliesChange={flow.updateDraft}
          claimId={pasted.draft.claimId}
          trackOptions={pasted.trackOptions}
          annotations={annotations}
          register={register}
        />
        <WizardFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={flow.pending}
            onClick={flow.restart}
          >
            {t("review.restart")}
          </Button>
          {/* The confirm is one mutation over the whole list, so the wait is
              proportional to how much was pasted: a spinner in place of the
              label, not just a dead button. */}
          <SubmitButton
            type="button"
            isSubmitting={flow.pending}
            disabled={!resolved.canCreate}
            onClick={() => flow.create()}
          >
            {t("review.cta", { count: resolved.counts.roles })}
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              aria-hidden="true"
            />
          </SubmitButton>
        </WizardFooter>
        {/* Below the CTA, so neither message reflows the list above it. The
            reason comes from the resolver, never re-derived here: a partial
            copy of its terms once told the user every role already existed
            while the real blocker was a card's missing name. Every blocker the
            resolver can report is answered here except "cardBlocked", whose
            cards carry their own alerts; a state with no line at all left a
            disabled "Create 0 roles" and nothing saying why. */}
        {resolved.blocker === "tooManyRoles" ? (
          <p className="text-muted-foreground text-sm">
            {t("review.tooManyRoles", {
              max: MAX_ROLES,
              count: resolved.counts.roles,
            })}
          </p>
        ) : resolved.blocker === "tooManyFamilies" ? (
          <p className="text-muted-foreground text-sm">
            {t("review.tooManyFamilies", { max: MAX_FAMILIES })}
          </p>
        ) : resolved.blocker === "allDuplicate" ? (
          // The count spans both places a duplicate is dropped (the seed,
          // before the review ever rendered the row, and the review itself),
          // so the line is true whichever of them emptied the import: a
          // categorical "every role already exists" would not be, once a user
          // has removed the rows that did not.
          <p className="text-muted-foreground text-sm">
            {t("review.nothingToAdd", { count: resolved.counts.skipped })}
          </p>
        ) : resolved.blocker === "empty" ? (
          <p className="text-muted-foreground text-sm">
            {t("review.nothingHere")}
          </p>
        ) : null}
        {flow.failure !== null && (
          <p role="alert" className="text-destructive text-sm">
            {flow.failure === "duplicate"
              ? tErrors("roleFamilyExists")
              : flow.failure === "invalid"
                ? t("review.invalid")
                : t("review.error")}
          </p>
        )}
      </ScreenShell>
    )
  }

  function renderPrefilling() {
    const { done, total } = flow.prefillProgress
    return (
      <WizardProgress
        className="mx-auto max-w-md"
        done={done}
        total={total}
        label={t("prefilling.heading")}
        heading
        description={t("prefilling.body")}
        countLabel={t.rich("prefilling.progress", {
          done: () => <NumberFlow value={done} />,
          total: () => <NumberFlow value={total} />,
        })}
        accent
      />
    )
  }

  function renderDone() {
    const result = flow.result
    // The done phase is derived from result being set, so this cannot be null.
    // Narrowed once here rather than defaulted per row: a fallback count would
    // turn a future machine bug into a success screen reporting zero roles.
    if (result === null) return null
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex justify-center">
          <SuccessCheck />
        </div>
        <ScreenShell
          heading={t("done.title")}
          description={t("done.description")}
        >
          <dl className="w-full space-y-2">
            <div className="flex items-center justify-between border-b py-2">
              <dt className="text-muted-foreground text-sm">
                {t("done.roles")}
              </dt>
              <dd className="font-medium text-sm">{result.roleCount}</dd>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <dt className="text-muted-foreground text-sm">
                {t("done.families")}
              </dt>
              <dd className="font-medium text-sm">{result.familyCount}</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-muted-foreground text-sm">
                {t("done.skipped")}
              </dt>
              <dd className="font-medium text-sm">{result.skippedCount}</dd>
            </div>
          </dl>
          <WizardFooter>
            <Button type="button" onClick={() => router.push("/roles")}>
              {t("done.cta")}
            </Button>
          </WizardFooter>
          {/* The only failure that reaches this screen is the prefill: a failed
              confirm leaves no result and keeps the review up. So it says the
              profiles are missing, never that the roles were not created,
              which the counts above have just shown to be false. */}
          {flow.failure !== null && (
            <p role="alert" className="text-destructive text-sm">
              {t("done.profilesFailed")}
            </p>
          )}
        </ScreenShell>
      </div>
    )
  }
}
