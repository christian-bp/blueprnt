import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { LEVEL_COUNT, ZONE_KEYS } from "@workspace/core"
import { zoneContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock("@workspace/backend/convex/_generated/api", async () => ({
  ...(await import("@/test/convex-mocks")).apiModule,
  components: {},
}))
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { LevelRulesPanel } from "@/components/model/level-rules-panel"
import { toast } from "@/lib/toast"
import { mockMutation, onQuery } from "@/test/convex-mocks"

const saveLevels = mockMutation("evaluationModel.approval.updateLevelRules")
const saveZones = mockMutation(
  "evaluationModel.approval.updateZoneProfileRules"
)
const m = messages.dashboard.model.levelRules
const v = messages.dashboard.validation

// The default ladder: twelve levels, minScore falling as the level rises,
// bottom at 0.
const LEVEL_RULES = [
  { level: 1, minScore: 97 },
  { level: 2, minScore: 92 },
  { level: 3, minScore: 87 },
  { level: 4, minScore: 81 },
  { level: 5, minScore: 75 },
  { level: 6, minScore: 69 },
  { level: 7, minScore: 62 },
  { level: 8, minScore: 55 },
  { level: 9, minScore: 48 },
  { level: 10, minScore: 40 },
  { level: 11, minScore: 31 },
  { level: 12, minScore: 0 },
]
const ZONE_RULES = [
  { zone: "A", minStep: 4 },
  { zone: "B", minStep: 3 },
]

let model: unknown = { levelRules: LEVEL_RULES, zoneProfileRules: ZONE_RULES }

function install() {
  onQuery((ref) =>
    ref === "evaluationModel.model.getModel" ? model : undefined
  )
}

function renderPanel({ open = true }: { open?: boolean } = {}) {
  const result = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LevelRulesPanel orgId="org-1" />
    </NextIntlClientProvider>
  )
  // Closed by default; most tests are about the opened content.
  if (open) {
    fireEvent.click(screen.getByRole("button", { name: m.toggleCta }))
  }
  return result
}

const levelField = (level: number) =>
  screen.getByLabelText(
    m.levelField.replace("{level}", String(level))
  ) as HTMLInputElement
const zoneField = (zone: string) =>
  screen.getByLabelText(m.zoneField.replace("{zone}", zone)) as HTMLInputElement
const save = () =>
  screen.getByRole("button", { name: m.save }) as HTMLButtonElement

describe("LevelRulesPanel", () => {
  beforeEach(() => {
    model = { levelRules: LEVEL_RULES, zoneProfileRules: ZONE_RULES }
    install()
    saveLevels.mockReset().mockResolvedValue(null)
    saveZones.mockReset().mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
  })
  afterEach(() => cleanup())

  // CLOSED BY DEFAULT: the thresholds are the model's most advanced dial,
  // and standing open they put sixteen inputs between the approval gate and
  // the reader. The collapsed frame still names itself, carries its help,
  // and opens on the row's own act.
  it("opens closed, and reveals the table on the toggle", () => {
    renderPanel({ open: false })
    expect(screen.getByText(m.title)).toBeDefined()
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.help.levelThresholdLabel,
      })
    ).toBeDefined()
    expect(
      screen.queryByLabelText(m.levelField.replace("{level}", "1"))
    ).toBeNull()
    expect(screen.queryByRole("button", { name: m.save })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: m.toggleCta }))
    expect(levelField(1).value).toBe("97")
  })

  it("shows every stored threshold and zone rule", () => {
    renderPanel()
    expect(levelField(1).value).toBe("97")
    expect(levelField(12).value).toBe("0")
    expect(zoneField("A").value).toBe("4")
    // A zone with no rule is empty, not zero: it is gated on the weighting
    // alone rather than at step 0.
    expect(zoneField("C").value).toBe("")
  })

  // The reader correcting a ladder is thinking in zones, not in a column of
  // twelve digits.
  it("groups the levels under their zone label, without the zone's prose name", () => {
    renderPanel()
    const content = zoneContent("en")
    for (const zone of ["A", "D"] as const) {
      expect(
        screen.getAllByText(
          messages.dashboard.levels.zoneLabel.replace("{zone}", zone)
        ).length
      ).toBeGreaterThan(0)
      // The zone's descriptive name stays off this table: it collided with
      // the level column and repeated what the zone surfaces already say.
      expect(screen.queryByText(content.zones[zone].name)).toBeNull()
    }
  })

  // Each threshold explains itself by what it produces: the To column and
  // the share bar are derived live from the field and its neighbours, which
  // is what makes the bare numbers readable without opening the help.
  it("derives each level's To bound live, and goes quiet on a broken ordering", () => {
    renderPanel()
    const row = (level: number) =>
      levelField(level).closest("tr") as HTMLTableRowElement
    // Level 1 runs to the scale's top; the rest end just below the neighbour
    // above; level 12's span is 0-30 under the default ladder.
    expect(row(1).textContent).toContain("100")
    expect(row(2).textContent).toContain("96")
    expect(row(12).textContent).toContain("30")
    // Editing a bound moves BOTH the level's own span and the one below it.
    fireEvent.change(levelField(1), { target: { value: "95" } })
    expect(row(2).textContent).toContain("94")
    // A broken ordering claims nothing on either side of the break: an
    // impossible span would be the form doing the arithmetic wrong, so the
    // cells go quiet and the validation owns the refusal.
    fireEvent.change(levelField(1), { target: { value: "80" } })
    expect(row(1).textContent).toContain("–")
    expect(row(2).textContent).toContain("–")
  })

  // A prefilled edit form: unchanged means nothing to save, and firing anyway
  // would write an audit row and reopen the approval for a change nobody made.
  it("keeps the save shut until something changes", async () => {
    renderPanel()
    expect(save().disabled).toBe(true)
    fireEvent.change(levelField(1), { target: { value: "96" } })
    fireEvent.blur(levelField(1))
    // Validation is async under the resolver, so the gate opens a tick later.
    await waitFor(() => expect(save().disabled).toBe(false))
  })

  // The isDirty half of the gate, on its own: a form edited back to what it
  // already said is VALID and has nothing to save. Without isDirty the button
  // would offer a write that reopens the approval for a change nobody made.
  // (Asserting the untouched form alone proves nothing: isValid is false until
  // the first validation runs, so the button is shut either way at mount.)
  it("shuts again when an edit is undone", async () => {
    renderPanel()
    fireEvent.change(levelField(1), { target: { value: "96" } })
    fireEvent.blur(levelField(1))
    await waitFor(() => expect(save().disabled).toBe(false))
    fireEvent.change(levelField(1), { target: { value: "97" } })
    fireEvent.blur(levelField(1))
    await waitFor(() => expect(save().disabled).toBe(true))
  })

  it("saves the whole ladder and toasts", async () => {
    renderPanel()
    fireEvent.change(levelField(1), { target: { value: "96" } })
    fireEvent.blur(levelField(1))
    await waitFor(() => expect(save().disabled).toBe(false))
    fireEvent.click(save())
    await waitFor(() => {
      expect(saveLevels).toHaveBeenCalledWith({
        orgId: "org-1",
        gestureId: expect.any(String),
        levelRules: LEVEL_RULES.map((rule) =>
          rule.level === 1 ? { level: 1, minScore: 96 } : rule
        ),
      })
    })
    expect(toast.success).toHaveBeenCalledWith(
      messages.dashboard.toast.thresholdsSaved
    )
  })

  // Two mutations, one form: an untouched half must not be written. The two
  // that DO fire share one gesture id, so their audit rows read as one story.
  it("writes only the half that changed", async () => {
    renderPanel()
    fireEvent.change(zoneField("B"), { target: { value: "2" } })
    fireEvent.blur(zoneField("B"))
    await waitFor(() => expect(save().disabled).toBe(false))
    fireEvent.click(save())
    await waitFor(() => {
      expect(saveZones).toHaveBeenCalledWith({
        orgId: "org-1",
        gestureId: expect.any(String),
        zoneProfileRules: [
          { zone: "A", minStep: 4 },
          { zone: "B", minStep: 2 },
        ],
      })
    })
    expect(saveLevels).not.toHaveBeenCalled()
  })

  it("gives both halves one gesture id when both change", async () => {
    renderPanel()
    fireEvent.change(levelField(1), { target: { value: "96" } })
    fireEvent.blur(levelField(1))
    fireEvent.change(zoneField("B"), { target: { value: "2" } })
    fireEvent.blur(zoneField("B"))
    await waitFor(() => expect(save().disabled).toBe(false))
    fireEvent.click(save())
    await waitFor(() => expect(saveZones).toHaveBeenCalled())
    const levelsId = saveLevels.mock.calls[0]?.[0]?.gestureId
    expect(typeof levelsId).toBe("string")
    expect(saveZones.mock.calls[0]?.[0]?.gestureId).toBe(levelsId)
  })

  // The engine's truths, said on the field that breaks them, before the
  // backend has to refuse. "The engine refused" under a button tells a reader
  // nothing about which of twelve numbers is wrong.
  it("marks a threshold that does not fall below the one above it", async () => {
    renderPanel()
    fireEvent.change(levelField(2), { target: { value: "99" } })
    fireEvent.blur(levelField(2))
    expect(await screen.findByText(v.levelDecreasing)).toBeDefined()
    expect(save().disabled).toBe(true)
    expect(saveLevels).not.toHaveBeenCalled()
  })

  it("marks a bottom level that does not open at 0", async () => {
    renderPanel()
    fireEvent.change(levelField(12), { target: { value: "5" } })
    fireEvent.blur(levelField(12))
    expect(await screen.findByText(v.levelBottomZero)).toBeDefined()
    expect(save().disabled).toBe(true)
  })

  it("marks a zone that asks more than the zone above it", async () => {
    renderPanel()
    fireEvent.change(zoneField("B"), { target: { value: "5" } })
    fireEvent.blur(zoneField("B"))
    expect(await screen.findByText(v.zoneMonotonic)).toBeDefined()
    expect(save().disabled).toBe(true)
  })

  // The backend is the authority. Reaching its refusal means the two
  // disagree, which is said on the form because we no longer know the field.
  it("surfaces the engine's refusal when the backend still says no", async () => {
    saveLevels.mockRejectedValue(new Error("errors.invalidInput"))
    renderPanel()
    fireEvent.change(levelField(1), { target: { value: "96" } })
    fireEvent.blur(levelField(1))
    await waitFor(() => expect(save().disabled).toBe(false))
    fireEvent.click(save())
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      m.invalid
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  // Editing thresholds is method-affecting: it falls the model back to draft.
  // A reader should know before pressing, not from the card changing under
  // them.
  it("says that saving reopens the approval, beside the save", () => {
    renderPanel()
    expect(screen.getByText(m.reopensApproval)).toBeDefined()
  })

  // The skeleton MEASURES like the form, and everything it can know for real it
  // states for real. The version this replaces drew the title and the labels as
  // gray bars, left out the second settings row and the whole footer, and its
  // guard asserted only "some skeleton exists" plus the absence of the Save
  // button, actively pinning the missing footer: replacing the entire skeleton
  // with one 4x4 bar passed it.
  it("shows a content-shaped skeleton while the model loads", () => {
    model = undefined
    install()
    const { container } = renderPanel()

    // Static i18n text, rendered rather than barred.
    expect(screen.getByText(m.title)).toBeDefined()
    expect(screen.getByText(m.levelsLabel)).toBeDefined()
    expect(screen.getByText(m.zonesLabel)).toBeDefined()
    expect(screen.getByText(m.reopensApproval)).toBeDefined()
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.help.levelThresholdLabel,
      })
    ).toBeDefined()

    // Structural law, also known before the data: the four zone labels and
    // the table's own headers.
    for (const zone of ZONE_KEYS) {
      expect(
        screen.getByText(
          messages.dashboard.levels.zoneLabel.replace("{zone}", zone)
        )
      ).toBeDefined()
    }
    expect(screen.getByText(m.fromColumn)).toBeDefined()
    expect(screen.getByText(m.shareColumn)).toBeDefined()

    // One bar per number the query has yet to answer, and nothing else.
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
      LEVEL_COUNT + ZONE_KEYS.length
    )

    // The footer is PRESENT so the panel does not grow a button row on
    // arrival, and disabled because the loaded form's own initial state is.
    const save = screen.getByRole("button", { name: m.save })
    expect((save as HTMLButtonElement).disabled).toBe(true)
  })
})
