"use client"

import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { MAX_STARTER_IMPORT_TEXT, SUGGESTION_KINDS } from "@workspace/constants"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { AnimatePresence, motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { FamiliesReview } from "@/components/onboarding/families-review"
import { NextButton } from "@/components/onboarding/next-button"
import { ScreenShell } from "@/components/onboarding/screen-shell"
import { TypewriterPlaceholder } from "@/components/onboarding/typewriter-placeholder"
import { WizardFooter } from "@/components/onboarding/wizard-footer"
import { useGeneratingStaleness } from "@/hooks/use-generating-staleness"
import { capitalizeFirst } from "@/lib/capitalize"
import { aiErrorSubKey } from "@/lib/error-label"
import type { DraftFamily } from "@/lib/family-dnd"
import { isDuplicateFamilyError } from "@/lib/family-error"
import { newestByKind } from "@/lib/open-suggestions"
import {
  starterImportInputSchema,
  starterImportValueSchema,
} from "@/lib/suggestion-schemas"

// What seeded the editable review list: the industry template, or an AI
// import whose suggestion the create button must close out (ADR-0003).
type SeedSource =
  | { source: "template" }
  | { source: "ai"; suggestionId: Id<"suggestions"> }

// Screen 6: rollfamiljer and roller. The user pastes their own role list
// (the AI groups it into families) or falls back to the industry template;
// either way the result is an editable review list, and nothing is written
// until "create and continue". Both paths complete onboarding.
export function FamiliesStep({
  orgId,
  organizationName,
  onFinished,
}: {
  orgId: string
  organizationName: string
  onFinished: () => void
}) {
  const t = useTranslations("dashboard.onboarding.families")
  const tReview = useTranslations("dashboard.model.review")
  const tAi = useTranslations("dashboard.ai")
  const tErrors = useTranslations("errors")
  const locale = useLocale()
  const starter = useQuery(api.assessment.starters.getIndustryStarter, {
    orgId,
    locale,
  })
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  // kind narrows the query to this panel's rows, so the import can never be
  // evicted from the per-status cap by newer suggestions of other kinds.
  const suggestions = useQuery(api.ai.suggest.getOpenSuggestions, {
    orgId,
    kind: SUGGESTION_KINDS.starterImport,
  })
  const createStarterSet = useMutation(api.assessment.starters.createStarterSet)
  const requestStarterImport = useMutation(api.ai.suggest.requestStarterImport)
  const confirmStarterImport = useMutation(api.ai.suggest.confirmStarterImport)
  const rejectSuggestion = useMutation(api.ai.suggest.rejectSuggestion)
  const completeOnboarding = useMutation(
    api.accounts.organization.completeOnboarding
  )

  const [rawText, setRawText] = useState("")
  const [families, setFamilies] = useState<DraftFamily[] | null>(null)
  const [nextId, setNextId] = useState(0)
  const [seededFrom, setSeededFrom] = useState<SeedSource | null>(null)
  const [pending, setPending] = useState(false)
  const [requestPending, setRequestPending] = useState(false)
  const [requestFailed, setRequestFailed] = useState(false)
  const [failure, setFailure] = useState<"duplicate" | "generic" | null>(null)
  // The creation step (confirm/create) and completeOnboarding are separate
  // backend writes: remember a successful creation so a retry after a failed
  // completeOnboarding only re-runs the completion, never the creation
  // (which would throw notFound / roleFamilyExists on the second run).
  const [created, setCreated] = useState(false)
  // Guards the seed-on-render block after "start over": the dismissed
  // suggestion may still read as suggested until the reject round-trips.
  const [lastDismissedId, setLastDismissedId] = useState<string | null>(null)

  const importRow = newestByKind(suggestions, SUGGESTION_KINDS.starterImport)
  const parsedImport =
    importRow?.status === "suggested"
      ? starterImportValueSchema.safeParse(importRow.suggestedValue)
      : null

  const isGenerating = importRow?.status === "generating"
  const isStaleGenerating = useGeneratingStaleness(importRow)

  // Seed the review list from a suggested AI import the first render both
  // the suggestion and the model (for valid track keys) are available
  // (adjust-state-during-render, the established pattern). Resuming after a
  // reload lands here too: an unreviewed import goes straight to review.
  if (
    seededFrom === null &&
    importRow?.status === "suggested" &&
    importRow.suggestionId !== lastDismissedId &&
    parsedImport?.success === true &&
    model !== undefined &&
    model !== null
  ) {
    const validKeys = new Set<string>(model.tracks.map((track) => track.key))
    const fallbackTrackKey = model.tracks[0]?.key ?? "IC"
    let id = 0
    setFamilies(
      parsedImport.data.families.map((family) => ({
        id: id++,
        name: family.name,
        roles: family.roles.map((role) => ({
          id: id++,
          title: role.title,
          trackKey: validKeys.has(role.trackKey)
            ? role.trackKey
            : fallbackTrackKey,
        })),
      }))
    )
    setNextId(id)
    setSeededFrom({ source: "ai", suggestionId: importRow.suggestionId })
  }

  function claimId(): number {
    const id = nextId
    setNextId(id + 1)
    return id
  }

  // Back to the paste view with the pasted text intact. An AI-seeded review
  // dismisses its suggestion (the lifecycle always ends in confirmed or
  // rejected); best-effort, with lastDismissedId blocking an instant re-seed.
  function restart() {
    if (seededFrom?.source === "ai") {
      rejectSuggestion({
        orgId,
        suggestionId: seededFrom.suggestionId,
      }).catch(() => {})
      setLastDismissedId(seededFrom.suggestionId)
    }
    setFamilies(null)
    setSeededFrom(null)
    setFailure(null)
  }

  function seedFromTemplate() {
    if (starter === undefined) return
    // Walking away from an open AI proposal dismisses it (the suggestion
    // lifecycle always ends in confirmed or rejected); a still-generating
    // row cannot be rejected and is simply superseded.
    if (
      importRow !== undefined &&
      (importRow.status === "suggested" || importRow.status === "failed")
    ) {
      rejectSuggestion({ orgId, suggestionId: importRow.suggestionId }).catch(
        () => {}
      )
    }
    let id = 0
    setFamilies(
      starter.families.map((family) => ({
        id: id++,
        name: family.name,
        roles: family.roles.map((role) => ({ id: id++, ...role })),
      }))
    )
    setNextId(id)
    setSeededFrom({ source: "template" })
  }

  async function onAnalyze() {
    const parsed = starterImportInputSchema.safeParse(rawText)
    if (!parsed.success) return
    setRequestPending(true)
    setRequestFailed(false)
    try {
      await requestStarterImport({ orgId, rawText: parsed.data, locale })
    } catch {
      setRequestFailed(true)
    } finally {
      setRequestPending(false)
    }
  }

  async function finish() {
    setPending(true)
    setFailure(null)
    try {
      if (!created) {
        const cleaned = (families ?? [])
          .map((family) => ({
            name: family.name.trim(),
            roles: family.roles
              .map((role) => ({
                title: role.title.trim(),
                trackKey: role.trackKey,
              }))
              .filter((role) => role.title !== ""),
          }))
          .filter((family) => family.name !== "")
        if (seededFrom?.source === "ai") {
          // The AI path closes the suggestion with the user's edited list;
          // an emptied list confirms nothing and rejects the suggestion.
          await confirmStarterImport({
            orgId,
            suggestionId: seededFrom.suggestionId,
            families: cleaned,
          })
        } else if (cleaned.length > 0) {
          await createStarterSet({ orgId, families: cleaned })
        }
        setCreated(true)
      }
      await completeOnboarding({ orgId })
      onFinished()
    } catch (error) {
      setFailure(isDuplicateFamilyError(error) ? "duplicate" : "generic")
      setPending(false)
    }
  }

  const inReview = seededFrom !== null && families !== null
  const showGenerating = isGenerating && !isStaleGenerating
  const phase = inReview ? "review" : showGenerating ? "generating" : "paste"

  // The review list needs the model's tracks for the Select options.
  if (inReview && (model === undefined || model === null)) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("heading", { name: organizationName })} />
      </main>
    )
  }

  const trackOptions = (model?.tracks ?? []).map((track) => ({
    trackKey: track.key,
    label: track.name,
  }))

  return (
    <ScreenShell
      // A name-first heading starts with the name as typed; heading
      // typography still wants a capital (translators may reorder).
      heading={capitalizeFirst(
        t("heading", { name: organizationName }),
        locale
      )}
      // Only the template review keeps a subtitle: its reassurance (adjust
      // freely, changeable later) works passively at the one step that
      // creates data. The paste view is covered by the animated placeholder
      // plus the help popover, and the AI review's line is the provenance
      // paragraph (ADR-0003), so neither carries a second subtitle.
      description={
        inReview && seededFrom?.source === "template"
          ? t("reviewDescriptionStarter")
          : undefined
      }
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
          {phase === "review" ? (
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
    const aiFailed = importRow?.status === "failed" || isStaleGenerating
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
            disabled={
              starter === undefined || model === undefined || model === null
            }
            onClick={seedFromTemplate}
          >
            {t("templateCta")}
          </Button>
        </div>
        <WizardFooter>
          <NextButton
            disabled={
              requestPending ||
              !starterImportInputSchema.safeParse(rawText).success
            }
            onClick={() => onAnalyze()}
          />
        </WizardFooter>
        {/* Alerts extend below the CTA so nothing on screen reflows. */}
        {(aiFailed || requestFailed) && (
          <p role="alert" className="text-destructive text-sm">
            {requestFailed
              ? t("error")
              : tErrors(
                  aiErrorSubKey(
                    importRow?.status === "failed"
                      ? (importRow.errorCode ?? "")
                      : ""
                  )
                )}
          </p>
        )}
      </div>
    )
  }

  function renderReviewPhase() {
    return (
      <>
        {seededFrom?.source === "ai" && (
          <p className="text-center text-muted-foreground text-sm">
            {tAi("provenance")}
          </p>
        )}
        <FamiliesReview
          families={families ?? []}
          onFamiliesChange={(updater) =>
            setFamilies((current) => updater(current ?? []))
          }
          claimId={claimId}
          trackOptions={trackOptions}
        />
        {failure !== null && (
          <p role="alert" className="text-destructive text-sm">
            {failure === "duplicate" ? tErrors("roleFamilyExists") : t("error")}
          </p>
        )}
        {/* The final step cannot be skipped: emptying the list and finishing
            is the explicit way to start without families. Start over returns
            to the paste view with the pasted text intact; it is disabled once
            the set was created (a failed completeOnboarding retry), because
            starting over would then create duplicates. */}
        <WizardFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={pending || created}
            onClick={restart}
          >
            {t("restartCta")}
          </Button>
          <Button type="button" disabled={pending} onClick={() => finish()}>
            {(families ?? []).length === 0 ? tReview("cta") : t("createCta")}
            <HugeiconsIcon
              icon={Tick02Icon}
              strokeWidth={2}
              aria-hidden="true"
            />
          </Button>
        </WizardFooter>
      </>
    )
  }
}
