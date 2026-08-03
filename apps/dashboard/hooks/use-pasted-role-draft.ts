"use client"

import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { SuggestionKind } from "@workspace/constants"
import { useEffect, useRef, useState } from "react"
import { type SeedFamily, useDraftFamilies } from "@/hooks/use-draft-families"
import {
  STALE_AFTER_MS,
  useGeneratingStaleness,
} from "@/hooks/use-generating-staleness"
import {
  type SuggestionFlow,
  type SuggestionFlowStatus,
  useSuggestionFlow,
} from "@/hooks/use-suggestion-flow"
import {
  starterImportInputSchema,
  type StarterImportValue,
  starterImportValueSchema,
} from "@/lib/suggestion-schemas"

export interface PastedRoleDraft {
  // The paste view's textarea state and its client gate.
  rawText: string
  setRawText: (value: string) => void
  inputValid: boolean
  // The request round trip (the generation itself is watched through `flow`).
  requestPending: boolean
  requestFailed: boolean
  // The shared read side of the AI suggestion lifecycle.
  flow: SuggestionFlow<StarterImportValue>
  // The lifecycle status of the proposal this surface OWNS: identical to
  // flow.status for a resuming caller, and "idle" for a non-resuming one until
  // its own analyze() has opened a proposal. Views branch on this, never on
  // flow.status directly: a row left over from a previous visit is being
  // dismissed on entry, so it must not put the screen into a wait or an error
  // on the way out.
  ownStatus: SuggestionFlowStatus
  // The editable review list.
  draft: ReturnType<typeof useDraftFamilies>
  trackOptions: { trackKey: string; label: string }[]
  // The proposal the review was seeded from; null until the seed runs.
  seededSuggestionId: Id<"suggestions"> | null
  // The seeded proposal hit the import's size caps, so the review is showing
  // fewer roles than the paste contained. Only the generation knows this (the
  // clamp happens at the AI trust boundary), so it rides along with the
  // proposal and the review surfaces it.
  truncated: boolean
  analyze: () => Promise<void>
  dismiss: () => void
}

// The paste to AI to editable-draft engine, shared by the onboarding families
// step and the in-app role import. It owns the textarea, the request, the
// suggestion lifecycle, and the seed that turns a suggested proposal into the
// editable review list. What each surface DOES with that list (reconcile a
// whole starter set, or add to an existing register) stays with the caller.
//
// The `request` mutation is injected rather than looked up here: the two
// surfaces target different suggestion kinds through different mutations that
// happen to take the same arguments.
export function usePastedRoleDraft(options: {
  orgId: string
  locale: string
  kind: SuggestionKind
  // Returns the id of the suggestion it opened, so a caller that does not
  // resume can tell its OWN proposal apart from one that was already there.
  request: (args: {
    orgId: string
    rawText: string
    locale: string
  }) => Promise<Id<"suggestions">>
  // The evaluation model's tracks. Undefined while loading; the seed waits for
  // them because it coerces the proposal's track keys against the real set.
  tracks: { key: string; name: string }[] | undefined
  // Whether a proposal that was ALREADY open when this surface mounted may be
  // picked up. Onboarding resumes: its step is a stage of a longer flow, so a
  // generation started before a reload belongs to the same piece of work. The
  // in-app import does not: it always opens on an empty paste screen, so a
  // pre-existing proposal is dismissed on entry (a dangling row must still end
  // in rejected, ADR-0003) and only a proposal this session's own analyze()
  // opened can seed the review.
  resume: boolean
  // False while ANOTHER source owns the screen. Onboarding has two other seed
  // sources (resume-from-existing, and the template create-on-pick), and the AI
  // seed must never win over either: a render-phase setState does not update
  // the caller's local values, so the caller passes an explicit gate instead of
  // relying on block ordering. The in-app import has no other source and passes
  // true (once its own merge data has loaded).
  canSeed: boolean
  // Places the proposal into a wider list on the ONE seed below, for a caller
  // whose review is about more than the proposal. The in-app import seeds the
  // org's whole register alongside it, so a proposed role can be dragged into
  // a family the AI did not target; drag and drop operates on the draft, so
  // those families have to BE in it. Onboarding passes none and seeds exactly
  // what the AI returned.
  prepareSeed?: (proposed: SeedFamily[]) => SeedFamily[]
}): PastedRoleDraft {
  const { orgId, locale, kind, request, tracks, canSeed, resume, prepareSeed } =
    options

  const flow = useSuggestionFlow({
    orgId,
    kind,
    schema: starterImportValueSchema,
  })
  const draft = useDraftFamilies()

  const [rawText, setRawText] = useState("")
  const [requestPending, setRequestPending] = useState(false)
  const [requestFailed, setRequestFailed] = useState(false)
  const [seededSuggestionId, setSeededSuggestionId] =
    useState<Id<"suggestions"> | null>(null)
  // Guards the seed block after a dismiss: the rejected suggestion may still
  // read as "suggested" until the reject round-trips, which would instantly
  // re-seed the review the user just left.
  const [lastDismissedId, setLastDismissedId] = useState<string | null>(null)
  // The proposal THIS visit opened, from the request's own return value. Only
  // it may seed the review when the caller does not resume.
  const [requestedSuggestionId, setRequestedSuggestionId] =
    useState<Id<"suggestions"> | null>(null)
  // When the request resolved, so a wait for a row that never arrives can be
  // given the same deadline a crashed generation gets.
  const [requestedAt, setRequestedAt] = useState<number | null>(null)
  // Every id this hook has already sent a reject for. A reject does not
  // round-trip synchronously and can fail, so "already asked to close" is
  // remembered rather than re-read off the row's status, which would re-send
  // the mutation on every render until the status flipped.
  const closedIds = useRef<Set<string>>(new Set())

  const openSuggestionId = flow.suggestionId
  const flowLoaded = flow.loaded
  // Whether the open proposal is this surface's to act on. requestPending
  // covers the window between clicking Analyse and the id coming back: the
  // subscription can deliver the new row first, and a row created a moment ago
  // must never be mistaken for one left over from a previous visit.
  const owned =
    resume ||
    requestPending ||
    (openSuggestionId !== null && openSuggestionId === requestedSuggestionId)

  // The request mutation has returned, so a generating row EXISTS, but the
  // subscription has not delivered it yet. Without this the hook reports idle
  // across that gap and the caller falls back to its paste screen: the CTA
  // re-enables under the user a moment after they pressed it, and pressing it
  // again opens a second generation and orphans the first. The mutation's own
  // return value is the proof the row is there, so the wait is reported from
  // the moment it resolves rather than from the moment the query agrees.
  //
  // Latched on first sight rather than left open-ended: once the row has been
  // seen, its real status governs (including useSuggestionFlow's staleness
  // check, which needs the row to work), and a synthesized wait would outlive
  // the row when the proposal is later confirmed or rejected and leaves the
  // open set.
  //
  // The latch stores WHICH row was seen, not merely that one was. A boolean
  // re-armed itself against the previous request during the pending window of
  // the next one: a failed generation stays in the open set, so on a retry the
  // old id was still both requested and open, the latch flipped back to true
  // about that old row, and the moment the new id arrived the hook reported
  // idle while the new generation was live. That is the same re-enabled CTA
  // this block exists to prevent, reached by clicking Analyse twice.
  const sawRequestedRow = useRef<Id<"suggestions"> | null>(null)
  if (
    requestedSuggestionId !== null &&
    openSuggestionId === requestedSuggestionId
  ) {
    sawRequestedRow.current = requestedSuggestionId
  }
  const awaitingOwnRow =
    requestPending ||
    (requestedSuggestionId !== null &&
      sawRequestedRow.current !== requestedSuggestionId)
  // ...but the wait is BOUNDED. Nothing guarantees the requested row is ever
  // delivered as open: another tab can close it before this one's subscription
  // catches up, and then the latch never sets and the screen waits on a
  // spinner it can only leave by reloading (restart() is reachable from the
  // review, which this state never reaches). The row's own staleness check
  // cannot help, because it needs the row. So the same deadline the panels
  // apply to a crashed generation applies to a generation that was never seen
  // at all: past it this reads as failed, which is retryable.
  const waitStarted = requestedAt
  const waitCrashed = useGeneratingStaleness(
    awaitingOwnRow && waitStarted !== null
      ? { status: "generating", createdAt: waitStarted }
      : undefined
  )

  // Close whatever was already open when a non-resuming surface mounted. The
  // review is unreachable for those rows (the seed gate below only accepts
  // this visit's own), but a suggestion's lifecycle always ends in confirmed or
  // rejected (ADR-0003), so leaving one dangling is not an option: it stays an
  // open row forever and, until it is closed, keeps reading as the newest open
  // proposal. Written as an effect, not a render-phase block: it sends a
  // mutation. It re-runs as the newest open row changes, so an org that
  // accumulated several open rows drains one per pass down to none.
  //
  // Bounded to rows that ALREADY existed when this surface mounted. Suggestions
  // are org-scoped, not per-user, so the newest open row is very often not
  // this surface's to close, and rejecting it kills someone else's work.
  //
  // Two bounds, because the mount order cuts both ways. The cutoff (the newest
  // row open at mount, compared on the row's own SERVER timestamp so client
  // clock skew cannot misclassify either side) protects a row created after
  // this surface opened. It does nothing for the opposite order: a tab opened
  // seconds after another tab pressed Analyse sees that live generation as a
  // pre-existing leftover. So a row that is still GENERATING and not yet stale
  // is never swept at all, whichever side of the cutoff it falls: by
  // definition it is someone's generation in flight, and the only reason it
  // looks abandoned from here is that getOpenSuggestions does not expose who
  // asked for it. A generation past the stale deadline is a crashed action and
  // is drained normally.
  const openRow = flow.row
  const openCreatedAt = openRow?.createdAt ?? null
  const leftoverCutoff = useRef<number | null>(null)
  if (leftoverCutoff.current === null && flowLoaded) {
    leftoverCutoff.current = openCreatedAt ?? 0
  }
  const openIsLive =
    openRow?.status === "generating" &&
    Date.now() - openRow.createdAt < STALE_AFTER_MS
  const rejectRef = useRef(flow.reject)
  rejectRef.current = flow.reject
  useEffect(() => {
    if (resume || owned || !flowLoaded || openSuggestionId === null) return
    if (openIsLive) return
    const cutoff = leftoverCutoff.current
    if (cutoff === null || openCreatedAt === null || openCreatedAt > cutoff) {
      return
    }
    if (closedIds.current.has(openSuggestionId)) return
    closedIds.current.add(openSuggestionId)
    // Fire and forget: nothing on screen is waiting for this, and a failed
    // dismissal must not block the empty paste screen the user came for.
    rejectRef.current().catch(() => {})
  }, [resume, owned, flowLoaded, openSuggestionId, openCreatedAt, openIsLive])

  // Seed the review list the first render both the suggestion and the tracks
  // are available (adjust-state-during-render, the established pattern here).
  // A resuming caller lands here after a reload too: its unreviewed proposal
  // goes straight to review.
  const importValue = flow.value
  if (
    seededSuggestionId === null &&
    canSeed &&
    flow.status === "suggested" &&
    flow.suggestionId !== null &&
    flow.suggestionId !== lastDismissedId &&
    (resume || flow.suggestionId === requestedSuggestionId) &&
    importValue !== null &&
    tracks !== undefined
  ) {
    const validKeys = new Set<string>(tracks.map((track) => track.key))
    const fallbackTrackKey = tracks[0]?.key ?? "IC"
    const proposed: SeedFamily[] = importValue.families
    draft.seed(
      prepareSeed === undefined ? proposed : prepareSeed(proposed),
      (trackKey) => (validKeys.has(trackKey) ? trackKey : fallbackTrackKey)
    )
    setSeededSuggestionId(flow.suggestionId)
  }

  return {
    rawText,
    setRawText,
    inputValid: starterImportInputSchema.safeParse(rawText).success,
    requestPending,
    requestFailed,
    flow,
    // A generation this visit started reads as generating from the moment the
    // request resolves, not from the moment the subscription agrees.
    ownStatus: awaitingOwnRow
      ? waitCrashed
        ? "failed"
        : "generating"
      : owned
        ? flow.status
        : "idle",
    draft,
    trackOptions: (tracks ?? []).map((track) => ({
      trackKey: track.key,
      label: track.name,
    })),
    seededSuggestionId,
    // Tied to the seeded proposal, so a dismissed review drops the notice with
    // the list it was about.
    truncated: seededSuggestionId !== null && importValue?.truncated === true,
    analyze: async () => {
      const parsed = starterImportInputSchema.safeParse(rawText)
      if (!parsed.success) return
      setRequestPending(true)
      setRequestFailed(false)
      try {
        const suggestionId = await request({
          orgId,
          rawText: parsed.data,
          locale,
        })
        setRequestedSuggestionId(suggestionId)
        setRequestedAt(Date.now())
      } catch {
        setRequestFailed(true)
      } finally {
        setRequestPending(false)
      }
    },
    // Back to the paste view with the pasted text intact. The suggestion
    // lifecycle always ends in confirmed or rejected, so an open proposal is
    // dismissed here whether or not it had already seeded a review; the reject
    // is fire-and-forget and flow.status does not flip synchronously, so the id
    // is also latched out of the seed block above.
    //
    // "Open" includes a STILL-GENERATING row: walking away from a generation
    // has to end it, or it lands minutes later and takes the screen the user
    // moved on to (onboarding's template path is where that bites: it dismisses
    // the proposal, creates the starter set, and a resurrected proposal would
    // hijack the paste view if the create then failed). Only the pair makes
    // that hold: rejectSuggestion accepts a generating row, and the
    // generation's own late write is dropped for a closed row (ai/persist.ts).
    dismiss: () => {
      const openId = seededSuggestionId ?? flow.suggestionId
      if (openId !== null && flow.status !== "idle") {
        flow.reject().catch(() => {})
        setLastDismissedId(openId)
        // Shared with the entry dismissal, so the row this just closed is
        // never sent a second reject the moment it stops counting as ours.
        closedIds.current.add(openId)
      }
      draft.clear()
      setSeededSuggestionId(null)
      // This visit no longer owns a proposal: a later one has to be requested
      // again before anything may seed the review.
      setRequestedSuggestionId(null)
      setRequestedAt(null)
    },
  }
}
