"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { SUGGESTION_KINDS } from "@workspace/constants"
import type { FunctionArgs } from "convex/server"
import { useAction, useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { type SeedFamily, useDraftFamilies } from "@/hooks/use-draft-families"
import { useSuggestionFlow } from "@/hooks/use-suggestion-flow"
import { isDuplicateFamilyError } from "@/lib/family-error"
import {
  starterImportInputSchema,
  starterImportValueSchema,
} from "@/lib/suggestion-schemas"

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

export type FamiliesDraftPhase = "paste" | "generating" | "review"

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
  flow: ReturnType<typeof useSuggestionFlow<unknown>>
  // True while finish() runs (persist + prefill).
  pending: boolean
  // True once an AI set was confirmed (disables Start over on a retry).
  created: boolean
  // True while a template discard is in flight (disables Start over).
  restartPending: boolean
  // The paste view's analyze gate.
  inputValid: boolean
  // Handlers.
  seedFromTemplate: () => Promise<void>
  onAnalyze: () => Promise<void>
  finish: () => Promise<void>
  restart: () => Promise<void>
}

// Owns the families step's draft flow: the queries it reads, the create /
// confirm / reconcile / request mutations and the prefill action, the AI
// suggestion lifecycle, the editable draft, and the interacting state flags
// that orchestrate paste / AI-import / template-create-on-pick /
// resume-from-existing / reconcile / prefill. The two render-phase seed blocks
// (resume-from-existing, AI-seed) run here as adjust-state-during-render, the
// established pattern; the component is a thin view over what this returns.
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
  // The shared suggestion lifecycle for the paste-import proposal; request
  // and confirm stay here (kind-specific args).
  const flow = useSuggestionFlow({
    orgId,
    kind: SUGGESTION_KINDS.starterImport,
    schema: starterImportValueSchema,
  })
  const createStarterSet = useMutation(api.assessment.starters.createStarterSet)
  const reconcileStarterSet = useMutation(
    api.assessment.starters.reconcileStarterSet
  )
  const requestStarterImport = useMutation(api.ai.suggest.requestStarterImport)
  const confirmStarterImport = useMutation(api.ai.suggest.confirmStarterImport)
  // Auto-prefills empty role profiles after the set is persisted. The action
  // skips roles that already have a profile (so an unchanged revisit makes no
  // model call), which is why finish() always calls it after persist rather
  // than gating on a possibly-stale client view of which roles are empty.
  const prefillRoleProfiles = useAction(api.ai.prefill.prefillRoleProfiles)

  // The editable review list (families, unique ids, cleaned payload).
  const draft = useDraftFamilies()

  const [rawText, setRawText] = useState("")
  const [seededFrom, setSeededFrom] = useState<SeedSource | null>(null)
  const [pending, setPending] = useState(false)
  const [requestPending, setRequestPending] = useState(false)
  const [requestFailed, setRequestFailed] = useState(false)
  const [failure, setFailure] = useState<"duplicate" | "generic" | null>(null)
  // Remember a successful creation so a retry after a later failure only
  // advances, never re-runs the creation (which would throw notFound /
  // roleFamilyExists on the second run).
  const [created, setCreated] = useState(false)
  // Guards the seed-on-render block after "start over": the dismissed
  // suggestion may still read as suggested until the reject round-trips.
  const [lastDismissedId, setLastDismissedId] = useState<string | null>(null)
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

  // Resume on a revisit: when the families step was finished once, families
  // and roles already exist, so seed the review straight from them (carrying
  // their real ids invisibly) and reconcile on advance. This runs BEFORE the
  // AI seed block, so a stale unreviewed suggestion never wins over the real
  // saved set; the forward flow has no roles yet, so the block stays off and
  // the paste/template/AI flow keeps charge. Latched on resumedExisting so the
  // still-present roles cannot re-seed after a deliberate clear.
  if (
    !resumedExisting &&
    seededFrom === null &&
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
    setSeededFrom({ source: "existing" })
    setResumedExisting(true)
  }

  // Seed the review list from a suggested AI import the first render both
  // the suggestion and the model (for valid track keys) are available
  // (adjust-state-during-render, the established pattern). Resuming after a
  // reload lands here too: an unreviewed import goes straight to review.
  // "Roles resolved and empty" is a precondition, not an ordering assumption:
  // a render-phase setSeededFrom does not update the local seededFrom const,
  // so if both seed blocks fired in one render the later AI block would
  // override the real saved set. Requiring existingRoles to be resolved
  // (not undefined) AND empty makes resume-from-existing win regardless of
  // block order, and keeps the AI block from seeding during the load window:
  // while listRoles is still loading (existingRoles === undefined) the AI
  // block stays off and the spinner holds until roles resolve, so a revisit's
  // stale import never seeds before resume-from-existing can claim charge.
  const importValue = flow.value
  if (
    seededFrom === null &&
    // Defense-in-depth against the template-create hijack: an in-progress or
    // just-resolved template create (createdViaTemplate, possibly before the
    // listRoles subscription reports the new roles) must never let the AI
    // block seed, regardless of how the reject round-trip is timed.
    !createdViaTemplate &&
    existingRoles !== undefined &&
    existingRoles.length === 0 &&
    flow.status === "suggested" &&
    flow.suggestionId !== null &&
    flow.suggestionId !== lastDismissedId &&
    importValue !== null &&
    model !== undefined &&
    model !== null
  ) {
    const validKeys = new Set<string>(model.tracks.map((track) => track.key))
    const fallbackTrackKey = model.tracks[0]?.key ?? "IC"
    draft.seed(importValue.families, (trackKey) =>
      validKeys.has(trackKey) ? trackKey : fallbackTrackKey
    )
    setSeededFrom({ source: "ai", suggestionId: flow.suggestionId })
  }

  // Back to the paste view with the pasted text intact. An AI-seeded review
  // dismisses its suggestion (the lifecycle always ends in confirmed or
  // rejected); best-effort, with lastDismissedId blocking an instant re-seed.
  // The just-created-via-template review (an "existing" review flagged
  // createdViaTemplate) instead DISCARDS: it reconciles to an empty set, which
  // archives every created role and removes every family, so the queries go
  // back to empty and the paste/template/AI choice can show again. A genuine
  // revisit never reaches this (its Start over is hidden), so reconcile-empty
  // can only wipe a set this session just created.
  async function restart() {
    if (createdViaTemplate) {
      if (restartPending) return
      setRestartPending(true)
      setFailure(null)
      try {
        await reconcileStarterSet({ orgId, families: [] })
        draft.clear()
        setSeededFrom(null)
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
    if (seededFrom?.source === "ai") {
      flow.reject().catch(() => {})
      setLastDismissedId(seededFrom.suggestionId)
    }
    draft.clear()
    setSeededFrom(null)
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
    // Walking away from an open AI proposal dismisses it (the suggestion
    // lifecycle always ends in confirmed or rejected); a still-generating
    // row cannot be rejected and is simply superseded. The reject is
    // fire-and-forget and flow.status (derived from getOpenSuggestions) does
    // not flip synchronously, so ALSO latch the id out of the AI seed block
    // the same way restart() does: without this, the in-flight window (create
    // pending, seededFrom still null, roles still empty, status still
    // "suggested") satisfies the AI block's gate and it would hijack the
    // screen onto the abandoned proposal.
    if (flow.status === "suggested" || flow.status === "failed") {
      flow.reject().catch(() => {})
      if (flow.suggestionId !== null) setLastDismissedId(flow.suggestionId)
    }
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
      // After the set is persisted, auto-prefill the empty role profiles so the
      // score step opens with drafted purpose + responsibilities. The action
      // skips non-empty roles (an unchanged revisit costs no model call) and
      // isolates per-call failures, returning counts rather than throwing for
      // them; only a hard/transport error rejects, and on that we surface the
      // generic error and let the user retry Next (a half-prefilled set still
      // advances cleanly later via the score step's manual fallback). The whole
      // span (persist + prefill) shares the one `pending` flag, so the Next
      // button stays in its loading state until the prefill resolves.
      const { failed } = await prefillRoleProfiles({ orgId })
      // A partial failure (one batched call hit a rate limit or timeout) leaves
      // some roles empty but does not throw. Give it ONE best-effort retry: the
      // action re-targets only the still-empty roles, so the roles that already
      // succeeded are never regenerated. The retry is swallowed and we advance
      // regardless. The score step's manual capture is the final fallback for
      // any role still empty after it, so a second miss must not block onboarding.
      if (failed > 0) {
        try {
          await prefillRoleProfiles({ orgId })
        } catch {
          // Best effort only: advancing with a few empty profiles is fine.
        }
      }
      // Onboarding is NOT completed here: the score step owns completion on
      // every exit path. This step only creates the starter set and advances.
      onAdvance()
    } catch (error) {
      // reconcile can throw roleFamilyExists (duplicate) / roleLocked /
      // invalidInput; map the duplicate to the existing duplicate message and
      // everything else to the generic one, exactly like the create paths. A
      // hard prefill reject lands here too and shows the generic error.
      setFailure(isDuplicateFamilyError(error) ? "duplicate" : "generic")
      setPending(false)
    }
  }

  const inReview = seededFrom !== null && draft.families !== null
  const phase: FamiliesDraftPhase = inReview
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

  const trackOptions = (model?.tracks ?? []).map((track) => ({
    trackKey: track.key,
    label: track.name,
  }))

  return {
    phase,
    inReview,
    reviewModelPending,
    loadingGate,
    draft,
    seededFrom,
    createdViaTemplate,
    trackOptions,
    rawText,
    setRawText,
    starterReady: starter !== undefined,
    modelReady: model !== undefined && model !== null,
    requestPending,
    requestFailed,
    failure,
    flow,
    pending,
    created,
    restartPending,
    inputValid: starterImportInputSchema.safeParse(rawText).success,
    seedFromTemplate,
    onAnalyze,
    finish,
    restart,
  }
}
