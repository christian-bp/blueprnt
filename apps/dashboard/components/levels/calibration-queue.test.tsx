import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
// The digit animation is the library's business, and its custom element does
// not exist in jsdom.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

import { CalibrationQueue } from "@/components/levels/calibration-queue"
import type { CalibrationInput } from "@/lib/calibration-queue"
import { toast } from "@/lib/toast"
import { mockMutation } from "@/test/convex-mocks"

const calibrate = mockMutation("assessment.locking.calibrateAssessment")
const m = messages.dashboard.levels.calibration

function role(overrides: Partial<CalibrationInput> = {}): CalibrationInput {
  return {
    roleId: "r1",
    slug: "analyst",
    title: "Analyst",
    trackKey: "IC",
    trackName: "Individual contributor",
    score: 60,
    level: 5,
    zone: "B",
    ratedCount: 9,
    totalCriteria: 9,
    readyToLock: false,
    familyId: null,
    familyName: null,
    anchor: null,
    locked: true,
    calibrated: false,
    methodDrift: false,
    profileLimited: false,
    profileFailures: [],
    ...overrides,
  }
}

function renderQueue(
  rows: CalibrationInput[],
  { modelApproved = true }: { modelApproved?: boolean } = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CalibrationQueue
        orgId="org-1"
        rows={rows}
        modelApproved={modelApproved}
      />
    </NextIntlClientProvider>
  )
}

function rowFor(title: string) {
  return screen.getByText(title).closest("li") as HTMLElement
}

describe("CalibrationQueue", () => {
  beforeEach(() => {
    calibrate.mockReset().mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => cleanup())

  // Every row says WHY it is here: the three classes are answered differently,
  // and "needs review" alone would leave the reader to guess which of three
  // questions is being asked.
  it("states the capped placement's reason and names what capped it", () => {
    renderQueue([
      role({
        profileLimited: true,
        profileFailures: [
          {
            criterionId: "c1",
            name: "Scope and impact",
            required: 4,
            actual: 3,
          },
        ],
      }),
    ])
    const row = rowFor("Analyst")
    expect(row.textContent).toContain(m.profileLimitedReason)
    // The evidence, not just the verdict: which criterion, what it asked for,
    // what the role scored. This is where profileFailures becomes visible.
    expect(row.textContent).toContain(
      m.profileLimitedFailure
        .replace("{name}", "Scope and impact")
        .replace("{required}", "4")
        .replace("{actual}", "3")
    )
  })

  it("states an anchor deviation with both levels", () => {
    renderQueue([
      role({
        title: "Head of Data",
        level: 5,
        anchor: { expectedLevel: 3, status: "active" },
      }),
    ])
    expect(rowFor("Head of Data").textContent).toContain(
      m.anchorDeviationReason.replace("{level}", "5").replace("{expected}", "3")
    )
  })

  it("states a stale lock and sends the reader to the assessment", () => {
    renderQueue([role({ title: "Nurse", slug: "nurse", methodDrift: true })])
    const row = rowFor("Nurse")
    expect(row.textContent).toContain(m.staleLockReason)
    const link = within(row).getByRole("link", { name: m.rateCta })
    expect(link.getAttribute("href")).toBe("/roles/nurse/rate")
  })

  // Only the capped class has an act of its own; the other two are resolved by
  // changing what caused them, so they link rather than offering a button.
  it("offers confirm only on the class the act belongs to", () => {
    renderQueue([
      role({ roleId: "a", title: "Capped", profileLimited: true }),
      role({
        roleId: "b",
        title: "Anchor",
        anchor: { expectedLevel: 1, status: "active" },
      }),
      role({ roleId: "c", title: "Stale", methodDrift: true }),
    ])
    expect(
      within(rowFor("Capped")).getByRole("button", { name: m.confirmCta })
    ).toBeDefined()
    expect(
      within(rowFor("Anchor")).queryByRole("button", { name: m.confirmCta })
    ).toBeNull()
    expect(
      within(rowFor("Stale")).queryByRole("button", { name: m.confirmCta })
    ).toBeNull()
  })

  it("confirms a placement, with an optional note, and says so", async () => {
    renderQueue([role({ profileLimited: true })])
    fireEvent.click(screen.getByRole("button", { name: m.confirmCta }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText(m.noteLabel), {
      target: { value: "Reviewed with the department head." },
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: m.confirmSubmit })
    )
    await waitFor(() => {
      expect(calibrate).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: "org-1",
          roleId: "r1",
          note: "Reviewed with the department head.",
        })
      )
    })
    expect(toast.success).toHaveBeenCalledWith(
      messages.dashboard.toast.placementConfirmed
    )
  })

  // The note is OPTIONAL: the act is "a person stands behind this placement",
  // which is complete without a sentence. A forced note is the forced-step
  // pattern, and the text people type to get past one is worse than none.
  it("confirms with no note at all, sending no empty string", async () => {
    renderQueue([role({ profileLimited: true })])
    fireEvent.click(screen.getByRole("button", { name: m.confirmCta }))
    const dialog = await screen.findByRole("dialog")
    const submit = within(dialog).getByRole("button", {
      name: m.confirmSubmit,
    }) as HTMLButtonElement
    // Live from the moment it opens: nothing to fill in first.
    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)
    await waitFor(() => expect(calibrate).toHaveBeenCalled())
    const [args] = calibrate.mock.calls[0] as [Record<string, unknown>]
    expect("note" in args).toBe(false)
  })

  it("keeps the dialog open and says so when the confirm fails", async () => {
    calibrate.mockRejectedValue(new Error("nope"))
    renderQueue([role({ profileLimited: true })])
    fireEvent.click(screen.getByRole("button", { name: m.confirmCta }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(
      within(dialog).getByRole("button", { name: m.confirmSubmit })
    )
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(messages.dashboard.toast.error)
    })
    expect(screen.getByRole("dialog")).toBeDefined()
  })

  it("shows the empty state when nothing needs reviewing", () => {
    renderQueue([role()])
    expect(screen.getByText(m.emptyTitle)).toBeDefined()
    expect(screen.getByText(m.emptyDescription)).toBeDefined()
  })

  // The precondition in words, not a hidden section: a reader who expected a
  // queue learns why there is none, and where to go.
  it("states the precondition when the method is not approved", () => {
    renderQueue([role({ profileLimited: true })], { modelApproved: false })
    expect(screen.getByText(m.unapprovedTitle)).toBeDefined()
    expect(
      screen.getByRole("link", { name: m.unapprovedCta }).getAttribute("href")
    ).toBe("/model")
    // And no queue rows, however the flags read.
    expect(screen.queryByRole("button", { name: m.confirmCta })).toBeNull()
  })

  it("counts the rows waiting, and drops the count at zero", () => {
    const { rerender } = renderQueue([
      role({ roleId: "a", title: "Capped", profileLimited: true }),
      role({ roleId: "b", title: "Stale", methodDrift: true }),
    ])
    expect(screen.getByText("2")).toBeDefined()
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CalibrationQueue orgId="org-1" rows={[role()]} modelApproved />
      </NextIntlClientProvider>
    )
    expect(screen.queryByText("2")).toBeNull()
  })

  // Role-level data only (Role != Person). The queue is a list of ROLES.
  it("shows nothing but role-level data", () => {
    const { container } = renderQueue([
      role({
        profileLimited: true,
        profileFailures: [
          { criterionId: "c1", name: "Scope", required: 4, actual: 2 },
        ],
      }),
    ])
    const rendered = container.textContent ?? ""
    for (const forbidden of [
      "salary",
      "Salary",
      "kr",
      "employee",
      "Employee",
    ]) {
      expect(rendered).not.toContain(forbidden)
    }
  })
})
