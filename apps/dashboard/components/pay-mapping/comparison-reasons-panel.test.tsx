import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ComparisonReasonsPanel } from "@/components/pay-mapping/comparison-reasons-panel"
import type { GroupAnalysis } from "@/components/pay-mapping/pay-mapping-gap-types"
import { mockMutation } from "@/test/convex-mocks"

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", role: "admin" }),
}))

const upsert = mockMutation("payMapping.analyses.upsertGroupAnalysis")

afterEach(() => {
  cleanup()
  upsert.mockClear()
})

const m = messages.dashboard.payMapping.review
const mReasons = messages.dashboard.payMapping.reasons

function renderPanel(
  props: Partial<Parameters<typeof ComparisonReasonsPanel>[0]> = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ComparisonReasonsPanel
        runId={"run-1" as Parameters<typeof ComparisonReasonsPanel>[0]["runId"]}
        groupKey="Nurse|3"
        comparisonKey="IT Manager|5"
        comparisonLabel="IT Manager"
        groupLabel="Nurse"
        analysis={undefined}
        locked={false}
        remainingCount={0}
        groupDone={false}
        onGroupReopened={vi.fn()}
        {...props}
      />
    </NextIntlClientProvider>
  )
}

function analysis(overrides: Partial<GroupAnalysis> = {}): GroupAnalysis {
  return {
    scope: "equivalentWork",
    groupKey: "Nurse|3",
    comparisonKey: "IT Manager|5",
    reasons: [],
    note: null,
    done: false,
    finding: null,
    ...overrides,
  }
}

// The panel answers for ONE comparison, so its heading has to name the pair.
// A panel that only said "objective reasons" left the reader unable to tell,
// once it opens inside a row, which difference they were explaining.
describe("ComparisonReasonsPanel", () => {
  it("names the pair it is answering for", () => {
    renderPanel()
    expect(
      screen.getByText(
        m.comparisonReasonsHeading
          .replace("{group}", "Nurse")
          .replace("{comparator}", "IT Manager")
      )
    ).toBeDefined()
  })

  // The reason is written against the comparison, never against the group:
  // without the key the save would land on the row carrying the group's own
  // klarmarkering.
  it("saves a reason against its own comparison, leaving the group undone", () => {
    renderPanel()
    fireEvent.click(screen.getByText(mReasons.experience))
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        groupKey: "Nurse|3",
        comparisonKey: "IT Manager|5",
        scope: "equivalentWork",
        reasons: ["experience"],
        done: false,
      })
    )
  })

  // Editing a DONE group's explanation reopens it, which is a second write of
  // the same event type a millisecond after the first. Without one gesture id
  // the log shows one chip click as two identical-looking pay-mapping edits
  // with nothing saying the second followed from the first, which in a
  // statutory kartlaggning trail is the place a reader most needs one act to
  // read as one story.
  it("gives the edit and the reopen it forces a single gesture id", async () => {
    renderPanel({ groupDone: true })
    fireEvent.click(screen.getByText(mReasons.experience))
    await waitFor(() => {
      expect(upsert).toHaveBeenCalledTimes(2)
    })
    const [edit, reopen] = (
      upsert.mock.calls as Array<
        [{ gestureId?: string; comparisonKey?: string }]
      >
    ).map(([args]) => args)
    expect(typeof edit?.gestureId).toBe("string")
    expect(edit?.gestureId).toBe(reopen?.gestureId)
    // The second call really is the reopen and not a repeat of the edit: the
    // edit is written against ONE comparison, the reopen against the group as
    // a whole and therefore without a comparisonKey. (`done: false` cannot
    // tell them apart; both calls send it.)
    expect(edit?.comparisonKey).toBe("IT Manager|5")
    expect(reopen?.comparisonKey).toBeUndefined()
  })
})

// One explanation often covers several comparators, and typing it once per
// row is what made a per-row rule look unworkable. The control is offered
// only when it would actually do something.
describe("ComparisonReasonsPanel: applying to the rest", () => {
  const bulkLabel = (count: number) =>
    m.applyToRemaining.replace("{count}", String(count))

  it("offers the bulk fill once this comparison is answered and others are not", () => {
    renderPanel({
      analysis: analysis({ reasons: ["experience"] }),
      remainingCount: 3,
    })
    expect(screen.getByRole("button", { name: bulkLabel(3) })).toBeDefined()
  })

  it("counts only the OTHER comparisons, so the label cannot overpromise", () => {
    renderPanel({
      analysis: analysis({ reasons: ["experience"] }),
      remainingCount: 1,
    })
    expect(screen.getByRole("button", { name: bulkLabel(1) })).toBeDefined()
    expect(screen.queryByRole("button", { name: bulkLabel(2) })).toBeNull()
  })

  it("stays hidden when nothing else is waiting for an answer", () => {
    renderPanel({
      analysis: analysis({ reasons: ["experience"] }),
      remainingCount: 0,
    })
    expect(
      screen.queryByRole("button", { name: /Use for the remaining/ })
    ).toBeNull()
  })

  // Nothing to copy: filling every other row with an empty explanation would
  // mark them answered by nothing.
  it("stays hidden until this comparison itself has a reason", () => {
    renderPanel({ remainingCount: 3 })
    expect(
      screen.queryByRole("button", { name: /Use for the remaining/ })
    ).toBeNull()
  })

  it("stays hidden on a completed run", () => {
    renderPanel({
      analysis: analysis({ reasons: ["experience"] }),
      remainingCount: 3,
      locked: true,
    })
    expect(
      screen.queryByRole("button", { name: /Use for the remaining/ })
    ).toBeNull()
  })
})
