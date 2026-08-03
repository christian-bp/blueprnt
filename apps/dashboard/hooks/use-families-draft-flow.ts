"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { SUGGESTION_KINDS } from "@workspace/constants"
import type { FunctionArgs } from "convex/server"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import type { SeedFamily, useDraftFamilies } from "@/hooks/use-draft-families"
import { usePastedRoleDraft } from "@/hooks/use-pasted-role-draft"
import {
  prefillProgressOf,
  useProfilePrefill,
} from "@/hooks/use-profile-prefill"
import type { SuggestionFlow } from "@/hooks/use-suggestion-flow"
import { isDuplicateFamilyError } from "@/lib/family-error"
import type { StarterImportValue } from "@/lib/suggestion-schemas"

// What seeded the editable review list: the already-created set (a revisit, or
// the just-created-this-session template set, both reconciled on advance) or an
// AI import whose suggestion the create button must close out (ADR-0003). The
// template path no longer has its own source: picking it creates immediately,
// then the created roles seed the "existing" review like any other saved set.
type SeedSource =
  | { source: "existing" }
  | { source: "ai"; suggestionId: Id<"suggestions"> }

// The exact reconcileStarterSet families payload, derived from the mutation so
// the literal track-key union stays in lockstep with the server validator.
type ReconcilePayload = FunctionArgs<
  typeof api.assessment.starters.reconcileStarterSet
>["families"]

// Bridge the draft's plain-string trackKey to the reconcile validator's
// literal union. The values are runtime-guaranteed (the resume seed coerces
// unknown keys to a valid one) and the backend re-validates each with
// isTrackKey, so this only re-states what the data already satisfies.
function assertReconcileTrackKeys(
  families: ReturnType<ReturnType<typeof useDraftFamilies>["cleanedWithIds"]>
): ReconcilePayload {
  return families as ReconcilePayload
}

export type FamiliesDraftPhase =
  | "paste"
  | "generating"
  | "review"
  | "prefilling"

export interface FamiliesDraftFlow {
  // The current phase the view renders.
  phase: FamiliesDraftPhase
  // True once a seed has produced an editable review list.
  inReview: boolean
  // Hold a spinner while the review needs the model's tracks but they are not
  // yet resolved.
  reviewModelPending: boolean
  // Hold a spinner before any seed runs: the revisit queries are loading, or a
  // template create-on-pick is in flight, or its created roles have not yet
  // reported. (Already false once generating/inReview/resumed.)
  loadingGate: boolean
  // The editable review list and its operations.
  draft: ReturnType<typeof useDraftFamilies>
  // What seeded the review (drives provenance, Start over, and advance routing).
  seededFrom: SeedSource | null
  // True only for the freshly-created-via-template review.
  createdViaTemplate: boolean
  // True when Start over would archive a persisted role set (any "existing"
  // review: a saved revisit or the just-created-via-template set). The view
  // gates the destructive Start over behind a confirm; otherwise (the AI review,
  // which created no roles yet) Start over is a plain non-destructive trigger.
  restartDestructive: boolean
  // Track options for the review's Select.
  trackOptions: { trackKey: string; label: string }[]
  // The paste view's textarea state.
  rawText: string
  setRawText: (value: string) => void
  // Flags the paste-view CTA / alerts read.
  starterReady: boolean
  modelReady: boolean
  requestPending: boolean
  requestFailed: boolean
  failure: "duplicate" | "generic" | null
  // The shared AI suggestion lifecycle for the paste-import proposal.
  flow: SuggestionFlow<StarterImportValue>
  // True while finish() runs (persist + prefill).
  pending: boolean
  // How many roles already have a complete profile out of the total, derived
  // live from listRoles. Drives the prefilling screen's progress bar: as each
  // prefill chunk commits, done climbs reactively without any new plumbing.
  prefillProgress: { done: number; total: number }
  // True once an AI set was confirmed (disables Start over on a retry).
  created: boolean
  // True while a template discard is in flight (disables Start over).
  restartPending: boolean
  // The AI grouping under review was clamped to the import's size caps, so the
  // list on screen is shorter than what was pasted.
  importTruncated: boolean
  // The paste view's analyze gate.
  inputValid: boolean
  // Handlers.
  seedFromTemplate: () => Promise<void>
  onAnalyze: () => Promise<void>
  finish: () => Promise<void>
  restart: () => Promise<void>
}

// Owns the families step's draft flow: the queries it reads, the create /
// confirm / reconcile mutations and the prefill action, and the interacting
// state flags that orchestrate paste / AI-import / template-create-on-pick /
// resume-from-existing / reconcile / prefill. The paste-to-AI-to-draft engine
// (textarea, request, suggestion lifecycle, AI seed) comes from
// usePastedRoleDraft; what stays here is the second seed source
// (resume-from-existing, a render-phase seed like the AI one) and everything
// onboarding does with the resulting list. The component is a thin view over
// what this returns.
export function useFamiliesDraftFlow(options: {
  orgId: string
  organizationName: string
  onAdvance: () => void
}): FamiliesDraftFlow {
  const { orgId, onAdvance } = options
  const t = useTranslations("dashboard.onboarding.families")
  const locale = useLocale()
  const starter = useQuery(api.assessment.starters.getIndustryStarter, {
    orgId,
    locale,
  })
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  // On a revisit, the families step has already been finished once: families
  // and roles exist, so the step resumes into an editable review of them
  // (seeded below) instead of the paste/template/AI create flow.
  const existingFamilies = useQuery(api.assessment.families.listRoleFamilies, {
    orgId,
    locale,
  })
  const existingRoles = useQuery(api.assessment.roles.listRoles, {
    orgId,
    locale,
  })
  const createStarterSet = useMutation(api.assessment.starters.createStarterSet)
  const reconcileStarterSet = useMutation(
    api.assessment.starters.reconcileStarterSet
  )
  const requestStarterImport = useMutation(api.ai.suggest.requestStarterImport)
  const confirmStarterImport = useMutation(api.ai.suggest.confirmStarterImport)
  // The shared post-persist prefill span (flag, single retry, hard-reject
  // handling). Onboarding passes no roleIds: every empty-profile role in a
  // just-created org is in scope, and every profile it drafts is recorded as
  // onboarding's own.
  const prefill = useProfilePrefill({ orgId, via: "onboardingPrefill" })

  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<"duplicate" | "generic" | null>(null)
  // Remember a successful creation so a retry after a later failure only
  // advances, never re-runs the creation (which would throw notFound /
  // roleFamilyExists on the second run).
  const [created, setCreated] = useState(false)
  // Latches the resume-from-existing seed so it fires once: the queried roles
  // stay non-empty after seeding, so without this a "start over" back to the
  // paste view would instantly re-seed the same review.
  const [resumedExisting, setResumedExisting] = useState(false)
  // The template path creates on pick (like the model step), then flows through
  // the resume-from-existing seed. createdViaTemplate marks the freshly-created
  // set so this one screen offers a discarding Start over (a genuine revisit
  // must not); templatePending covers the in-flight create so the paste view
  // never flashes and the create runs at most once. restartPending guards the
  // discard against a double-click.
  const [createdViaTemplate, setCreatedViaTemplate] = useState(false)
  const [templatePending, setTemplatePending] = useState(false)
  const [restartPending, setRestartPending] = useState(false)

  // The AI seed must not fire while another source owns the screen: a genuine
  // revisit (resume-from-existing) or an in-flight template create. Requiring
  // roles to be RESOLVED and empty makes this independent of block ordering,
  // and createdViaTemplate covers the window where the create has resolved but
  // the listRoles subscription has not yet reported the new roles.
  const canSeedFromAi =
    !resumedExisting &&
    !createdViaTemplate &&
    existingRoles !== undefined &&
    existingRoles.length === 0

  const pasted = usePastedRoleDraft({
    orgId,
    locale,
    kind: SUGGESTION_KINDS.starterImport,
    request: requestStarterImport,
    tracks: model?.tracks,
    canSeed: canSeedFromAi,
    // Onboarding resumes: the step can be left mid-generation (a reload, a
    // step back) and coming back to a finished proposal is the same piece of
    // work, so an already-open proposal still seeds the review here.
    resume: true,
  })
  const { draft, flow } = pasted

  // Resume on a revisit: when the families step was finished once, families
  // and roles already exist, so seed the review straight from them (carrying
  // their real ids invisibly) and reconcile on advance. The AI seed inside
  // usePastedRoleDraft has already run for this render, but canSeedFromAi kept
  // it off while roles are present, so a stale unreviewed suggestion never wins
  // over the real saved set; the forward flow has no roles yet, so this block
  // stays off and the paste/template/AI flow keeps charge. Latched on
  // resumedExisting so the still-present roles cannot re-seed after a
  // deliberate clear.
  if (
    !resumedExisting &&
    pasted.seededSuggestionId === null &&
    existingRoles !== undefined &&
    existingRoles.length > 0 &&
    existingFamilies !== undefined &&
    model !== undefined &&
    model !== null
  ) {
    const validKeys = new Set<string>(model.tracks.map((track) => track.key))
    const fallbackTrackKey = model.tracks[0]?.key ?? "IC"
    const coerce = (trackKey: string) =>
      validKeys.has(trackKey) ? trackKey : fallbackTrackKey
    // Group roles under their family, preserving the family ordering from
    // listRoleFamilies (each group carries its real familyId). A role with no
    // family (familyId null) falls under a single "Other roles" group with no
    // familyId: the review only renders roles inside family cards, so this is
    // the only consistent way to show such a role editable. Reconcile reads an
    // absent familyId as a new family, so on advance the orphans get gathered
    // into a created family (acceptable on the onboarding revisit, where the
    // starter set created every role inside a family to begin with).
    const groupById = new Map<string, SeedFamily>()
    const familyOrder: SeedFamily[] = existingFamilies.map((family) => {
      const group: SeedFamily = {
        familyId: family.familyId,
        name: family.name,
        roles: [],
      }
      groupById.set(family.familyId as string, group)
      return group
    })
    let ungrouped: SeedFamily | null = null
    for (const role of existingRoles) {
      const entry = {
        roleId: role.roleId,
        title: role.title,
        trackKey: coerce(role.trackKey),
      }
      const group =
        role.familyId !== null ? groupById.get(role.familyId as string) : null
      if (group !== null && group !== undefined) {
        group.roles.push(entry)
      } else {
        if (ungrouped === null) {
          ungrouped = { name: t("ungroupedFamilyName"), roles: [] }
          familyOrder.push(ungrouped)
        }
        ungrouped.roles.push(entry)
      }
    }
    draft.seed(familyOrder)
    setResumedExisting(true)
  }

  // What seeded the review, derived rather than stored: the resume latch means
  // the existing set, a seeded proposal means the AI. Nothing else can seed.
  const seededFrom: SeedSource | null = resumedExisting
    ? { source: "existing" }
    : pasted.seededSuggestionId !== null
      ? { source: "ai", suggestionId: pasted.seededSuggestionId }
      : null

  // Back to the paste view with the pasted text intact. An AI-seeded review
  // dismisses its suggestion through the shared engine (the lifecycle always
  // ends in confirmed or rejected), which also blocks an instant re-seed.
  // Any "existing" review (a saved revisit OR the just-created-via-template set,
  // both flowing through the resume-from-existing seed) instead DISCARDS: it
  // reconciles to an empty set, which archives every active role and removes
  // every family, so the queries go back to empty and the paste/template/AI
  // choice can show again. The view gates this behind a two-step confirm (it is
  // destructive), so a revisit cannot wipe its saved set with one click. After
  // reconcile-empty the queried roles are gone, so the resume-from-existing seed
  // (latched on roles being present) stays off and does not re-seed the set.
  async function restart() {
    if (seededFrom?.source === "existing") {
      if (restartPending) return
      setRestartPending(true)
      setFailure(null)
      try {
        await reconcileStarterSet({ orgId, families: [] })
        draft.clear()
        setResumedExisting(false)
        setCreatedViaTemplate(false)
        setFailure(null)
      } catch (error) {
        setFailure(isDuplicateFamilyError(error) ? "duplicate" : "generic")
      } finally {
        setRestartPending(false)
      }
      return
    }
    pasted.dismiss()
    setFailure(null)
  }

  // The template path creates immediately on pick (matching the model step),
  // then lets the resume-from-existing seed render the editable review from the
  // now-created roles. Nothing is seeded locally: persisting on pick is what
  // makes the choice survive a remount (navigating back a step and forward
  // again). Guarded by templatePending so it runs once; only reachable from the
  // paste view.
  async function seedFromTemplate() {
    if (starter === undefined || templatePending) return
    // Walking away from an open AI proposal dismisses it (the lifecycle always
    // ends in confirmed or rejected) and latches its id out of the seed block,
    // so the in-flight window (create pending, nothing seeded yet, roles still
    // empty, status still "suggested") cannot let it hijack the screen.
    pasted.dismiss()
    setCreatedViaTemplate(true)
    setTemplatePending(true)
    setFailure(null)
    try {
      await createStarterSet({ orgId, families: starter.families })
    } catch (error) {
      setFailure(isDuplicateFamilyError(error) ? "duplicate" : "generic")
      setCreatedViaTemplate(false)
    } finally {
      setTemplatePending(false)
    }
  }

  async function finish() {
    setPending(true)
    setFailure(null)
    try {
      if (seededFrom?.source === "existing") {
        // The revisit + just-created-via-template path: reconcile the edited
        // list against the stored set. Reconcile is idempotent (it diffs by id),
        // so there is no `created` re-run concern and a retry after a failure
        // simply diffs again. The draft carries trackKey as a plain string (the
        // Select yields strings, and the resume seed coerces unknown keys to a
        // valid one); reconcile's validator is the literal track-key union, so
        // the payload is asserted here and the backend re-validates each key
        // with isTrackKey.
        await reconcileStarterSet({
          orgId,
          families: assertReconcileTrackKeys(draft.cleanedWithIds()),
        })
      } else if (seededFrom?.source === "ai" && !created) {
        // The AI path closes the suggestion with the user's edited list; an
        // emptied list confirms nothing and rejects the suggestion. The
        // `created` guard makes a retry after a later failure only advance,
        // never re-confirm (which would throw on the second run).
        await confirmStarterImport({
          orgId,
          suggestionId: seededFrom.suggestionId,
          families: draft.cleaned(),
        })
        setCreated(true)
      }
      // Whether prefill will have anything to draft, decided up front
      // (existingRoles is the stale render-closure value on the AI path, where
      // confirmStarterImport creates the new empty roles during finish()). The
      // AI import always produces brand-new roles with empty profiles; the
      // template/revisit paths reuse existing roles, so only show the screen
      // when some stored role still lacks a profile.
      const willPrefill =
        seededFrom?.source === "ai"
          ? (draft.families ?? []).some((family) => family.roles.length > 0)
          : (existingRoles ?? []).some((role) => !role.profileComplete)
      await prefill.run({ locale, willPrefill })
      // Onboarding is NOT completed here: the score step owns completion on
      // every exit path. This step only creates the starter set and advances.
      onAdvance()
    } catch (error) {
      // reconcile can throw roleFamilyExists (duplicate) / roleLocked /
      // invalidInput; map the duplicate to the existing duplicate message and
      // everything else to the generic one, exactly like the create paths. A
      // hard prefill reject lands here too and shows the generic error; the
      // prefill hook has already dropped its own screen flag.
      setFailure(isDuplicateFamilyError(error) ? "duplicate" : "generic")
      setPending(false)
    }
  }

  const inReview = seededFrom !== null && draft.families !== null
  // The prefilling screen wins while set: it covers the (possibly long) prefill
  // span after persist, replacing the review's Next-button spinner with a
  // dedicated loader + progress bar.
  const phase: FamiliesDraftPhase = prefill.prefilling
    ? "prefilling"
    : inReview
      ? "review"
      : flow.status === "generating"
        ? "generating"
        : "paste"

  // The review list needs the model's tracks for the Select options.
  const reviewModelPending = inReview && (model === undefined || model === null)

  // Hold the spinner until the revisit queries resolve, so a revisit never
  // flashes the paste view before the resume-from-existing seed runs. Only
  // matters before any seed (seededFrom null) and while no AI proposal is
  // already mid-flight (generating wins, since that is the forward flow). The
  // queries still loading, OR roles present but the model not yet ready (the
  // seed needs the model's tracks), both keep spinning.
  //
  // The template create-on-pick also holds the spinner here: from the click
  // (templatePending) through the window where the create has resolved but the
  // listRoles subscription has not yet reported the new roles (createdViaTemplate
  // with existingRoles not yet non-empty), the paste view would otherwise flash
  // before the resume-from-existing seed claims charge. On a create FAILURE
  // createdViaTemplate is reset, so the gate releases back to the paste view
  // with the alert.
  const templateCreatePending =
    templatePending ||
    (createdViaTemplate &&
      !(existingRoles !== undefined && existingRoles.length > 0))
  const revisitPending =
    existingRoles === undefined ||
    existingFamilies === undefined ||
    (existingRoles.length > 0 && (model === undefined || model === null))
  const loadingGate =
    !inReview &&
    flow.status !== "generating" &&
    !resumedExisting &&
    (revisitPending || templateCreatePending)

  // Live prefill progress from listRoles, unscoped: during onboarding every
  // role in the org belongs to the set being created.
  const prefillProgress = prefillProgressOf(existingRoles)

  return {
    phase,
    inReview,
    reviewModelPending,
    loadingGate,
    draft,
    seededFrom,
    createdViaTemplate,
    restartDestructive: seededFrom?.source === "existing",
    trackOptions: pasted.trackOptions,
    rawText: pasted.rawText,
    setRawText: pasted.setRawText,
    starterReady: starter !== undefined,
    modelReady: model !== undefined && model !== null,
    requestPending: pasted.requestPending,
    requestFailed: pasted.requestFailed,
    failure,
    flow,
    pending,
    prefillProgress,
    created,
    restartPending,
    // Only the AI review can be truncated: the template and revisit seeds come
    // from stored roles, which never went through the import's caps.
    importTruncated: seededFrom?.source === "ai" && pasted.truncated,
    inputValid: pasted.inputValid,
    seedFromTemplate,
    onAnalyze: pasted.analyze,
    finish,
    restart,
  }
}
