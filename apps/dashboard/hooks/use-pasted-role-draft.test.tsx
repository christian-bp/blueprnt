import { act, cleanup, render } from "@testing-library/react"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { SUGGESTION_KINDS } from "@workspace/constants"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { mockMutation, onQuery } from "@/test/convex-mocks"

const rejectSuggestionMock = mockMutation("ai.suggest.rejectSuggestion")
const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock("convex/react", async () => {
  return (await import("@/test/convex-mocks")).convexReactModule
})
vi.mock("@workspace/backend/convex/_generated/api", async () => {
  return (await import("@/test/convex-mocks")).apiModule
})

import type { SeedFamily } from "@/hooks/use-draft-families"
import { STALE_AFTER_MS } from "@/hooks/use-generating-staleness"
import { usePastedRoleDraft } from "@/hooks/use-pasted-role-draft"

const TRACKS = [
  { key: "IC", name: "Individual Contributor" },
  { key: "Lead", name: "Lead" },
]

function suggestedRow() {
  return {
    suggestionId: "sugg-1",
    kind: SUGGESTION_KINDS.starterImport,
    status: "suggested",
    suggestedValue: {
      truncated: false,
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Developer", trackKey: "IC" },
            // An unknown key must be coerced to the first track.
            { title: "Tech Lead", trackKey: "Boss" },
          ],
        },
      ],
    },
    errorCode: null,
    createdAt: 1,
    roleId: null,
  }
}

// Mid-generation. createdAt must be fresh: the shared flow reads a long-running
// generating row as a crashed one.
function generatingRow() {
  return {
    suggestionId: "sugg-1",
    kind: SUGGESTION_KINDS.starterImport,
    status: "generating",
    suggestedValue: null,
    errorCode: null,
    createdAt: Date.now(),
    roleId: null,
  }
}

// A generation that failed. getOpenSuggestions returns failed rows, so this
// stays the newest OPEN row and is what a retry has to be told apart from.
function failedRow() {
  return {
    suggestionId: "sugg-1",
    kind: SUGGESTION_KINDS.starterImport,
    status: "failed",
    suggestedValue: null,
    errorCode: "aiGenerationFailed",
    createdAt: Date.now(),
    roleId: null,
  }
}

type Hook = ReturnType<typeof usePastedRoleDraft>

type RequestFn = (args: {
  orgId: string
  rawText: string
  locale: string
}) => Promise<Id<"suggestions">>

const SUGGESTION_ID = "sugg-1" as Id<"suggestions">

function renderHook(options: {
  canSeed?: boolean
  // Distinguishes "not passed" (use TRACKS) from an explicit undefined, which
  // is the still-loading case the seed must wait for.
  tracks?: typeof TRACKS | undefined
  request?: RequestFn
  // Defaults to the resuming caller (onboarding); the in-app import passes
  // false and is covered by its own cases below.
  resume?: boolean
  prepareSeed?: (proposed: SeedFamily[]) => SeedFamily[]
}) {
  const captured: { current: Hook | null } = { current: null }
  const request: RequestFn =
    options.request ?? (() => Promise.resolve(SUGGESTION_ID))
  const tracks = "tracks" in options ? options.tracks : TRACKS
  function Probe({ canSeed }: { canSeed: boolean }) {
    captured.current = usePastedRoleDraft({
      orgId: "org-1",
      locale: "sv",
      kind: SUGGESTION_KINDS.starterImport,
      request,
      tracks,
      canSeed,
      resume: options.resume ?? true,
      prepareSeed: options.prepareSeed,
    })
    return null
  }
  const view = render(<Probe canSeed={options.canSeed ?? true} />)
  // The gate arrives as a prop so it can change on a MOUNTED hook: Probe keeps
  // its identity across the rerender, so a flip is a live transition and not a
  // fresh mount with different arguments.
  const setCanSeed = (canSeed: boolean) => {
    view.rerender(<Probe canSeed={canSeed} />)
  }
  // Re-renders the mounted hook so it re-reads the mocked subscription, the
  // way a Convex update would deliver a row that was not there before.
  const rerender = () => {
    view.rerender(<Probe canSeed={options.canSeed ?? true} />)
  }
  return { captured, view, setCanSeed, rerender }
}

describe("usePastedRoleDraft", () => {
  beforeEach(() => {
    rejectSuggestionMock.mockReset()
    rejectSuggestionMock.mockResolvedValue(null)
    useQueryMock.mockReset()
    useQueryMock.mockReturnValue([])
  })

  afterEach(() => {
    cleanup()
  })

  it("gates the analyze CTA on the shared input schema", () => {
    const { captured, view } = renderHook({})
    expect(captured.current?.inputValid).toBe(false)
    act(() => captured.current?.setRawText("   \n  "))
    expect(captured.current?.inputValid).toBe(false)
    act(() => captured.current?.setRawText("Developer"))
    expect(captured.current?.inputValid).toBe(true)
    act(() => captured.current?.setRawText("x".repeat(20_001)))
    expect(captured.current?.inputValid).toBe(false)
    view.unmount()
  })

  it("sends the trimmed text to the injected request", async () => {
    const request = vi.fn().mockResolvedValue(null)
    const { captured } = renderHook({ request })
    act(() => captured.current?.setRawText("  Developer\nTech Lead  "))
    await act(async () => {
      await captured.current?.analyze()
    })
    expect(request).toHaveBeenCalledWith({
      orgId: "org-1",
      rawText: "Developer\nTech Lead",
      locale: "sv",
    })
  })

  // The request resolves before the subscription redelivers the row it just
  // created. Reporting idle across that gap sends the caller back to its paste
  // screen and re-enables the CTA under the user a moment after they pressed
  // it; pressing it again opens a second generation and orphans the first.
  it("reports generating from the moment the request resolves, before the row arrives", async () => {
    // The query still knows nothing: the row exists server-side only.
    useQueryMock.mockReturnValue([])
    const request = vi.fn().mockResolvedValue("sugg-new")
    const { captured } = renderHook({ request })
    act(() => captured.current?.setRawText("Developer"))
    await act(async () => {
      await captured.current?.analyze()
    })
    expect(captured.current?.requestPending).toBe(false)
    expect(captured.current?.ownStatus).toBe("generating")
  })

  // And it hands back over as soon as the row is real, so the row's own status
  // governs from then on (including the staleness check, which needs the row).
  it("defers to the row's own status once the subscription delivers it", async () => {
    useQueryMock.mockReturnValue([])
    const request = vi.fn().mockResolvedValue("sugg-1")
    const { captured, rerender } = renderHook({ request })
    act(() => captured.current?.setRawText("Developer"))
    await act(async () => {
      await captured.current?.analyze()
    })
    useQueryMock.mockReturnValue([suggestedRow()])
    act(() => {
      rerender()
    })
    expect(captured.current?.ownStatus).toBe("suggested")
  })

  it("does not call the request when the input is invalid", async () => {
    const request = vi.fn().mockResolvedValue(null)
    const { captured } = renderHook({ request })
    await act(async () => {
      await captured.current?.analyze()
    })
    expect(request).not.toHaveBeenCalled()
  })

  it("flags a failed request without losing the pasted text", async () => {
    const request = vi.fn().mockRejectedValue(new Error("offline"))
    const { captured } = renderHook({ request })
    act(() => captured.current?.setRawText("Developer"))
    await act(async () => {
      await captured.current?.analyze()
    })
    expect(captured.current?.requestFailed).toBe(true)
    expect(captured.current?.rawText).toBe("Developer")
  })

  it("seeds the draft from a suggested proposal and coerces unknown tracks", () => {
    useQueryMock.mockReturnValue([suggestedRow()])
    const { captured } = renderHook({})
    expect(captured.current?.seededSuggestionId).toBe("sugg-1")
    expect(captured.current?.draft.families).toEqual([
      {
        id: 0,
        name: "Engineering",
        roles: [
          { id: 1, title: "Developer", trackKey: "IC" },
          { id: 2, title: "Tech Lead", trackKey: "IC" },
        ],
      },
    ])
  })

  // The in-app import's whole register rides in on this ONE seed: drag and
  // drop operates on the draft, so a family that is not in it cannot be a drop
  // target. The transform runs on the proposal, and its result is what the
  // track coercion and the id numbering are applied to.
  it("seeds through prepareSeed when the caller supplies one", () => {
    useQueryMock.mockReturnValue([suggestedRow()])
    const { captured } = renderHook({
      prepareSeed: (proposed) => [
        ...proposed,
        { name: "Legal", roles: [] },
        { name: "Sales", roles: [{ title: "AE", trackKey: "Boss" }] },
      ],
    })
    expect(captured.current?.draft.families).toEqual([
      {
        id: 0,
        name: "Engineering",
        roles: [
          { id: 1, title: "Developer", trackKey: "IC" },
          { id: 2, title: "Tech Lead", trackKey: "IC" },
        ],
      },
      { id: 3, name: "Legal", roles: [] },
      { id: 4, name: "Sales", roles: [{ id: 5, title: "AE", trackKey: "IC" }] },
    ])
  })

  it("does not seed while canSeed is false", () => {
    useQueryMock.mockReturnValue([suggestedRow()])
    const { captured } = renderHook({ canSeed: false })
    expect(captured.current?.seededSuggestionId).toBeNull()
    expect(captured.current?.draft.families).toBeNull()
  })

  it("seeds once canSeed flips true on a later render", () => {
    // The gate's real shape is a TRANSITION, not a one-shot: every caller opens
    // it false (its own queries are still loading) and turns it true a render
    // or more later. A seed that only ever evaluates on the first render would
    // leave a finished proposal permanently unreachable behind the paste view,
    // with nothing thrown, so the deferred case is pinned separately from the
    // closed-gate case.
    useQueryMock.mockReturnValue([suggestedRow()])
    const { captured, setCanSeed } = renderHook({ canSeed: false })
    expect(captured.current?.seededSuggestionId).toBeNull()
    expect(captured.current?.draft.families).toBeNull()

    setCanSeed(true)

    expect(captured.current?.seededSuggestionId).toBe("sugg-1")
    expect(captured.current?.draft.families).toEqual([
      {
        id: 0,
        name: "Engineering",
        roles: [
          { id: 1, title: "Developer", trackKey: "IC" },
          { id: 2, title: "Tech Lead", trackKey: "IC" },
        ],
      },
    ])
  })

  it("does not seed before the tracks have loaded", () => {
    useQueryMock.mockReturnValue([suggestedRow()])
    const { captured } = renderHook({ tracks: undefined })
    expect(captured.current?.seededSuggestionId).toBeNull()
  })

  it("dismiss rejects the proposal, clears the draft, and blocks a re-seed", () => {
    useQueryMock.mockReturnValue([suggestedRow()])
    const { captured } = renderHook({})
    expect(captured.current?.seededSuggestionId).toBe("sugg-1")
    act(() => captured.current?.dismiss())
    expect(rejectSuggestionMock).toHaveBeenCalledWith({
      orgId: "org-1",
      suggestionId: "sugg-1",
    })
    expect(captured.current?.seededSuggestionId).toBeNull()
    expect(captured.current?.draft.families).toBeNull()
  })

  it("dismisses a merely open proposal that was never seeded", () => {
    useQueryMock.mockReturnValue([suggestedRow()])
    const { captured } = renderHook({ canSeed: false })
    // Assert the precondition, or the case silently degrades into a duplicate
    // of the seeded dismiss above: it is the only test pinning the
    // seededSuggestionId ?? flow.suggestionId fallback that a caller walking
    // away from an unseeded proposal (seedFromTemplate) depends on.
    expect(captured.current?.seededSuggestionId).toBeNull()
    act(() => captured.current?.dismiss())
    expect(rejectSuggestionMock).toHaveBeenCalledWith({
      orgId: "org-1",
      suggestionId: "sugg-1",
    })
  })

  // Walking away from a generation has to END it. Onboarding's template path
  // is where this bites: it dismisses the open proposal and creates the starter
  // set, and a generation left running would land afterwards and hijack the
  // screen. Only the pair makes it hold (the backend accepts a reject on a
  // generating row, and drops the generation's late write once it is closed).
  it("dismisses a still-generating proposal", () => {
    useQueryMock.mockReturnValue([generatingRow()])
    const { captured } = renderHook({})
    act(() => captured.current?.dismiss())
    expect(rejectSuggestionMock).toHaveBeenCalledWith({
      orgId: "org-1",
      suggestionId: "sugg-1",
    })
  })

  // The in-app import never resumes: it opens on an empty paste screen every
  // visit, so a proposal that was already open is not the user's work to pick
  // up. It is closed rather than ignored, because a suggestion's lifecycle
  // always ends in confirmed or rejected (ADR-0003).
  it("dismisses a proposal that was already open instead of seeding it", () => {
    useQueryMock.mockReturnValue([suggestedRow()])
    const { captured } = renderHook({ resume: false })
    expect(captured.current?.seededSuggestionId).toBeNull()
    expect(captured.current?.draft.families).toBeNull()
    expect(rejectSuggestionMock).toHaveBeenCalledWith({
      orgId: "org-1",
      suggestionId: "sugg-1",
    })
    // The row is not this surface's to report on either: its status must not
    // put a wait or an error on the paste screen while it is being closed.
    expect(captured.current?.ownStatus).toBe("idle")
  })

  it("sends one dismissal for a pre-existing proposal, not one per render", () => {
    useQueryMock.mockReturnValue([suggestedRow()])
    const { rerender } = renderHook({ resume: false })
    rerender()
    rerender()
    expect(rejectSuggestionMock).toHaveBeenCalledTimes(1)
  })

  // The cutoff only protects a row created AFTER this surface mounted. Open a
  // second tab moments after the first pressed Analyse and the order inverts:
  // the live generation predates this mount and reads as a leftover. Killing
  // it drops the other tab back to an empty paste screen with no error, so a
  // generation still in flight is never swept from either side.
  it("leaves a live generation that predates this surface", () => {
    useQueryMock.mockReturnValue([generatingRow()])
    const { captured } = renderHook({ resume: false })
    expect(rejectSuggestionMock).not.toHaveBeenCalled()
    expect(captured.current?.ownStatus).toBe("idle")
  })

  // ...but a generating row past the stale deadline is a crashed action, not
  // someone's work, so it still drains.
  it("still sweeps a generation that crashed", () => {
    useQueryMock.mockReturnValue([
      { ...generatingRow(), createdAt: Date.now() - STALE_AFTER_MS - 1_000 },
    ])
    renderHook({ resume: false })
    expect(rejectSuggestionMock).toHaveBeenCalledTimes(1)
  })

  // The sweep only ever sees the NEWEST open row, so draining several is a
  // sequence: reject the newest, let the query settle, reject the next. The
  // timestamp cutoff is what keeps that going (every leftover predates the
  // mount), and nothing pinned it beyond the single-row case.
  it("drains several leftovers, one per pass", () => {
    const older = { ...suggestedRow(), suggestionId: "sugg-old", createdAt: 1 }
    const newer = { ...suggestedRow(), suggestionId: "sugg-new", createdAt: 2 }
    useQueryMock.mockReturnValue([older, newer])
    const { rerender } = renderHook({ resume: false })
    expect(rejectSuggestionMock).toHaveBeenCalledTimes(1)
    // The newest is closed, so the query now delivers only the older one.
    useQueryMock.mockReturnValue([older])
    rerender()
    expect(rejectSuggestionMock).toHaveBeenCalledTimes(2)
  })

  // Nothing guarantees the requested row is ever delivered as open: another
  // tab can close it before this subscription catches up. Without a deadline
  // the latch never sets and the screen waits on a spinner it can only leave
  // by reloading, because restart() lives on the review this state never
  // reaches. Past the deadline it reads as failed, which is retryable.
  it("gives up waiting for a row that never arrives", async () => {
    useQueryMock.mockReturnValue([])
    const request = vi.fn().mockResolvedValue("sugg-gone")
    const { captured, rerender } = renderHook({ resume: false, request })
    act(() => captured.current?.setRawText("Developer"))
    await act(async () => {
      await captured.current?.analyze()
    })
    expect(captured.current?.ownStatus).toBe("generating")
    // Past the same deadline a crashed generation gets.
    vi.useFakeTimers({ now: Date.now() + STALE_AFTER_MS + 1_000 })
    try {
      act(() => {
        rerender()
      })
      expect(captured.current?.ownStatus).toBe("failed")
    } finally {
      vi.useRealTimers()
    }
  })

  it("seeds a proposal this visit's own analyze opened", async () => {
    // Nothing open at mount, so nothing is dismissed; the request returns the
    // id of the proposal it created, and only that one may seed.
    useQueryMock.mockReturnValue([])
    const { captured, rerender } = renderHook({ resume: false })
    act(() => captured.current?.setRawText("Developer\nTech Lead"))
    await act(async () => {
      await captured.current?.analyze()
    })
    useQueryMock.mockReturnValue([suggestedRow()])
    rerender()
    expect(captured.current?.seededSuggestionId).toBe("sugg-1")
    expect(captured.current?.ownStatus).toBe("suggested")
    expect(rejectSuggestionMock).not.toHaveBeenCalled()
  })

  it("does not re-dismiss the proposal it just dismissed itself", async () => {
    // Start over on a proposal this visit opened. The reject is
    // fire-and-forget, so the row still reads as suggested afterwards and it
    // stops counting as this visit's: without the shared bookkeeping the entry
    // sweep would then read it as a leftover and send a second reject.
    useQueryMock.mockReturnValue([])
    const { captured, rerender } = renderHook({ resume: false })
    act(() => captured.current?.setRawText("Developer"))
    await act(async () => {
      await captured.current?.analyze()
    })
    useQueryMock.mockReturnValue([suggestedRow()])
    rerender()
    act(() => captured.current?.dismiss())
    expect(rejectSuggestionMock).toHaveBeenCalledTimes(1)
    rerender()
    expect(rejectSuggestionMock).toHaveBeenCalledTimes(1)
  })

  // A retry after THIS visit's own generation failed. The failed row stays in
  // the open set, so at the moment the retry's id comes back the previous id is
  // still both the requested one and the open one. A latch that only remembered
  // THAT a row had been seen re-armed itself against that old row during the
  // pending window, and the hook then reported idle while the new generation
  // was live: the CTA came back under the user and a third click would orphan
  // the second generation.
  it("keeps reporting generating when a retry follows this visit's failure", async () => {
    useQueryMock.mockReturnValue([])
    // The retry's request is held open so the hook RENDERS while it is
    // pending, the way it does in the app (that render is what shows the CTA
    // its own pending state). Resolving inside one act() batches that render
    // away and the sequence under test never happens.
    let resolveRetry: (id: Id<"suggestions">) => void = () => {}
    const request = vi
      .fn()
      .mockResolvedValueOnce("sugg-1" as Id<"suggestions">)
      .mockImplementationOnce(
        () =>
          new Promise<Id<"suggestions">>((resolve) => {
            resolveRetry = resolve
          })
      )
    const { captured, rerender } = renderHook({ resume: false, request })
    act(() => captured.current?.setRawText("Developer"))
    await act(async () => {
      await captured.current?.analyze()
    })
    useQueryMock.mockReturnValue([failedRow()])
    rerender()
    expect(captured.current?.ownStatus).toBe("failed")
    // Retry. The old failed row is still the open one, and still the requested
    // one until the new id arrives: the window where the latch used to re-arm.
    act(() => {
      void captured.current?.analyze()
    })
    rerender()
    expect(captured.current?.ownStatus).toBe("generating")
    // The new id lands while the subscription still holds the old row.
    await act(async () => {
      resolveRetry("sugg-2" as Id<"suggestions">)
      await Promise.resolve()
    })
    expect(captured.current?.ownStatus).toBe("generating")
  })

  // Suggestions are org-scoped, not per-user, so a second tab (or a second HR
  // operator in the same org) opening a proposal makes it THIS surface's newest
  // open row. Sweeping it would reject a live generation out from under them
  // and drop them back to an empty paste screen with no error at all.
  it("leaves a proposal opened after this surface mounted", () => {
    // Nothing open at mount, so there is no leftover to drain and the cutoff
    // admits nothing.
    useQueryMock.mockReturnValue([])
    const { captured, rerender } = renderHook({ resume: false })
    useQueryMock.mockReturnValue([generatingRow()])
    rerender()
    expect(rejectSuggestionMock).not.toHaveBeenCalled()
    // Not this surface's to report on either.
    expect(captured.current?.ownStatus).toBe("idle")
  })

  it("exposes the model tracks as review select options", () => {
    const { captured } = renderHook({})
    expect(captured.current?.trackOptions).toEqual([
      { trackKey: "IC", label: "Individual Contributor" },
      { trackKey: "Lead", label: "Lead" },
    ])
  })
})
