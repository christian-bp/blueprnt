"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { SUGGESTION_KINDS } from "@workspace/constants"
import { useMutation, useQuery } from "convex/react"
import type { FunctionArgs } from "convex/server"
import { useLocale } from "next-intl"
import { useMemo, useState } from "react"
import type {
  RegisterRole,
  ReviewAnnotations,
  ReviewRegister,
} from "@/components/family-review-table"
import {
  type PastedRoleDraft,
  usePastedRoleDraft,
} from "@/hooks/use-pasted-role-draft"
import {
  type PrefillProgress,
  prefillProgressOf,
  useProfilePrefill,
} from "@/hooks/use-profile-prefill"
import type { DraftFamily } from "@/lib/family-dnd"
import { isDuplicateFamilyError, isInvalidInputError } from "@/lib/family-error"
import {
  type ExistingFamily,
  type ImportPayloadFamily,
  type ResolvedImport,
  resolveImportTargets,
} from "@/lib/role-import"
import { buildImportSeed } from "@/lib/role-import-seed"

export type RoleImportPhase =
  | "paste"
  | "generating"
  | "review"
  | "prefilling"
  | "done"

export interface RoleImportFlow {
  phase: RoleImportPhase
  pasted: PastedRoleDraft
  resolved: ResolvedImport
  annotations: ReviewAnnotations
  // The org's current families and their roles, so the review can show the
  // whole register a proposed role may be dragged into.
  register: ReviewRegister
  // True across confirm + prefill, so the review's CTA stays inert.
  pending: boolean
  // "invalid" is the server's whole-payload rejection. It is kept apart from
  // "generic" because the two need different words: a rejected payload means
  // something in the list is out of bounds and editing it is the fix, while
  // the generic message invites a pointless retry of the same list.
  failure: "duplicate" | "invalid" | "generic" | null
  result: {
    familyCount: number
    roleCount: number
    skippedCount: number
  } | null
  prefillProgress: PrefillProgress
  // Edits the review list AND clears a stale failure, so the red alert cannot
  // outlive the edit that fixed what it was about.
  updateDraft: (updater: (current: DraftFamily[]) => DraftFamily[]) => void
  create: () => Promise<void>
  restart: () => void
}

// The exact confirmRoleImport families payload, derived from the mutation so
// the literal track-key union stays in lockstep with the server validator.
type ConfirmPayload = FunctionArgs<
  typeof api.ai.suggest.confirmRoleImport
>["families"]

// Bridge the resolved payload's plain-string trackKey to the confirm
// validator's literal union. The values are runtime-guaranteed (the seed
// coerces every proposed key against the model's real tracks, and the Select
// only offers those), and the backend re-validates each one, so this only
// re-states what the data already satisfies.
function assertConfirmTrackKeys(
  payload: ImportPayloadFamily[]
): ConfirmPayload {
  return payload as ConfirmPayload
}

// The in-app role import flow. Purely additive, so it has none of onboarding's
// extra machinery: no industry template, no resume-from-existing, no reconcile.
// What it adds instead is the existing register, which every render is resolved
// against the edited draft so the review and the submitted payload are the same
// derivation.
//
// Every visit starts over. Nothing is written until Create, so a half-reviewed
// proposal is not the user's work to preserve, and carrying one across visits
// meant an import they walked away from days ago greeted them instead of the
// paste screen they came for.
export function useRoleImportFlow(options: { orgId: string }): RoleImportFlow {
  const { orgId } = options
  const locale = useLocale()

  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const existingFamilies = useQuery(api.assessment.families.listRoleFamilies, {
    orgId,
    locale,
  })
  const existingRoles = useQuery(api.assessment.roles.listRoles, {
    orgId,
    locale,
  })
  const requestRoleImport = useMutation(api.ai.suggest.requestRoleImport)
  const confirmRoleImport = useMutation(api.ai.suggest.confirmRoleImport)
  // Every profile this import drafts records the IMPORT as its provenance.
  // Sharing onboarding's value would attribute an editor's in-app import at an
  // established org to onboarding, in the one row the AI auto-apply exception
  // relies on for traceability.
  const prefill = useProfilePrefill({ orgId, via: "roleImportPrefill" })

  // The register has to be loaded before a proposal may seed the review:
  // resolving against an empty register would show every family as new and
  // every title as fresh, then quietly change under the user.
  const registerReady =
    model !== undefined &&
    model !== null &&
    existingFamilies !== undefined &&
    existingRoles !== undefined

  // The register, in the two shapes this flow needs it: the name/id pairs the
  // resolver and the seed match against, and the per-family detail the review
  // renders. Both are derived from the same two queries, so nothing new is
  // read for this.
  const registerFamilies: ExistingFamily[] = (existingFamilies ?? []).map(
    (family) => ({ familyId: family.familyId, name: family.name })
  )
  const registerRoles = (existingRoles ?? []).map((role) => ({
    title: role.title,
    familyId: role.familyId,
  }))

  // Proposed rows the SEED dropped because the family they target already holds
  // the title, captured at the moment the seed ran rather than re-derived
  // later: those rows are not in the draft and never will be, so nothing
  // downstream can count them, and re-deriving them against a register that has
  // since moved would report a number this import did not act on.
  const [seedSkipped, setSeedSkipped] = useState(0)

  const pasted = usePastedRoleDraft({
    orgId,
    locale,
    kind: SUGGESTION_KINDS.roleImport,
    request: requestRoleImport,
    tracks: model?.tracks,
    canSeed: registerReady,
    // Never resume: the wizard opens on an empty paste screen every visit, and
    // whatever was left open last time is dismissed on entry. Nothing is saved
    // until Create, so there is nothing to come back to.
    resume: false,
    // The whole register enters the draft through this ONE seed, not a second
    // render-phase pass: drag and drop operates on the draft, so a family that
    // is not in it cannot be a drop target. The same pass drops the proposed
    // rows the target family already holds, so a duplicate never becomes a row
    // at all. canSeed already guarantees the queries have answered by the time
    // this runs.
    //
    // The setState is part of the same render-phase seed block that already
    // calls draft.seed() and setSeededSuggestionId(): one render, one seed, and
    // the count of what it dropped recorded with it.
    prepareSeed: (proposed) => {
      const seed = buildImportSeed(
        proposed,
        registerFamilies,
        registerRoles,
        locale
      )
      setSeedSkipped(seed.skipped)
      return seed.families
    },
  })

  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<RoleImportFlow["failure"]>(null)
  const [createdRoleIds, setCreatedRoleIds] = useState<Id<"roles">[] | null>(
    null
  )
  const [result, setResult] = useState<RoleImportFlow["result"]>(null)
  // Latches a committed confirm so nothing can send it twice. A suggestion is
  // consumed by its confirm, so a second send hits a closed proposal and throws
  // notFound, which would replace a real success with a permanent false error.
  const [created, setCreated] = useState(false)

  const resolved = resolveImportTargets(
    pasted.draft.families ?? [],
    registerFamilies,
    registerRoles,
    // Folded in here so counts.skipped is the WHOLE "already existed" story:
    // what the seed dropped before the review saw it, plus what the review
    // marked. One number behind the CTA's gate, the explanation under it and
    // the total the confirm reports.
    seedSkipped
  )

  // The register as the review renders it, keyed by the real family id the
  // seed put on each card. An injected family reaches the payload through
  // nothing but its roles, so this is display data only. No count travels
  // here: every role is rendered as its own row below, so a number that only
  // restates what is already on screen would not help any decision here.
  //
  // Memoized on the two subscriptions it is built from: this is a pass over
  // every family and every role in the org, and the review re-renders on
  // every keystroke in it.
  const register: ReviewRegister = useMemo(() => {
    // Built through mutable arrays and handed out as a ReviewRegister, whose
    // rows are readonly: the table shares module-level empty defaults across
    // every instance, so nothing downstream may append to what it is given.
    const detail = new Map<string, { roles: RegisterRole[] }>()
    for (const family of existingFamilies ?? []) {
      detail.set(family.familyId, { roles: [] })
    }
    for (const role of existingRoles ?? []) {
      if (role.familyId === null) continue
      detail.get(role.familyId)?.roles.push({
        id: role.roleId,
        title: role.title,
        trackKey: role.trackKey,
        trackName: role.trackName,
      })
    }
    return detail
  }, [existingFamilies, existingRoles])

  const annotations: ReviewAnnotations = {
    collidingFamilyIds: new Set(
      resolved.families
        .filter((family) => family.colliding)
        .map((family) => family.id)
    ),
    nameMissingFamilyIds: new Set(
      resolved.families
        .filter((family) => family.nameMissing)
        .map((family) => family.id)
    ),
    duplicateRoleIds: new Set(
      resolved.families.flatMap((family) =>
        family.roles.filter((role) => role.duplicate).map((role) => role.id)
      )
    ),
    blankRoleIds: new Set(
      resolved.families.flatMap((family) =>
        family.roles.filter((role) => role.blank).map((role) => role.id)
      )
    ),
  }

  // No hold before the paste view: this wizard always opens empty, so there is
  // no proposal that could arrive and replace what is being typed. The only
  // wait left is the generation this visit started.
  const phase: RoleImportPhase = pending
    ? prefill.prefilling
      ? "prefilling"
      : "review"
    : result !== null
      ? "done"
      : pasted.seededSuggestionId !== null && pasted.draft.families !== null
        ? "review"
        : // ownStatus, not flow.status: a proposal left over from a previous
          // visit is being dismissed on entry and must not hold this screen in
          // a wait on its way out.
          pasted.ownStatus === "generating"
          ? "generating"
          : "paste"

  return {
    phase,
    pasted,
    resolved,
    annotations,
    register,
    pending,
    failure,
    result,
    // Measures only what this import created, so the bar reflects this run and
    // not whatever else in the org happens to lack a profile.
    prefillProgress: prefillProgressOf(
      existingRoles,
      createdRoleIds ?? undefined
    ),
    updateDraft: (updater) => {
      // Any edit invalidates the previous attempt's verdict: the alert must not
      // survive the change that fixed what it was complaining about.
      setFailure(null)
      pasted.draft.update(updater)
    },
    create: async () => {
      const suggestionId = pasted.seededSuggestionId
      if (suggestionId === null || !resolved.canCreate || pending || created) {
        return
      }
      // Everything this import will not create because it already exists: the
      // rows the seed never let onto the screen plus the ones the review
      // marked. The payload deliberately excludes both, so the server can only
      // ever count the races that arrived after review; reporting its number
      // alone made "Already existed" structurally zero on every import.
      const skippedInReview = resolved.counts.skipped
      setPending(true)
      setFailure(null)
      try {
        const outcome = await confirmRoleImport({
          orgId,
          suggestionId,
          families: assertConfirmTrackKeys(resolved.payload),
          skippedInReview,
        })
        setCreated(true)
        setCreatedRoleIds(outcome.createdRoleIds)
        setResult({
          familyCount: outcome.familyCount,
          roleCount: outcome.roleCount,
          // Both halves of the story: what the review dropped, plus what the
          // write itself found already taken between review and confirm.
          skippedCount: skippedInReview + outcome.skippedCount,
        })
        // Draft the profiles for exactly these roles, so an imported role is
        // evaluatable straight away (the rate step is gated on a complete
        // profile) without touching any other empty role in the org.
        await prefill.run({
          locale,
          willPrefill: outcome.createdRoleIds.length > 0,
          roleIds: outcome.createdRoleIds,
        })
      } catch (error) {
        // A hard prefill reject lands here too. The roles were still created,
        // so the result stays set and the done screen reports them; the profile
        // is then drafted per role from the role page.
        setFailure(
          isDuplicateFamilyError(error)
            ? "duplicate"
            : isInvalidInputError(error)
              ? "invalid"
              : "generic"
        )
      } finally {
        setPending(false)
      }
    },
    // Back to an empty paste view. Every trace of a previous run is cleared,
    // not only what the current machine can reach: an added "import more"
    // affordance would otherwise snap straight back to the done screen with
    // the last run's counts and prefill against its role ids.
    restart: () => {
      setFailure(null)
      setResult(null)
      setCreatedRoleIds(null)
      setCreated(false)
      // The dropped-at-seed count belongs to the proposal being dismissed: left
      // standing it would be added to the next one's skips.
      setSeedSkipped(0)
      pasted.dismiss()
    },
  }
}
