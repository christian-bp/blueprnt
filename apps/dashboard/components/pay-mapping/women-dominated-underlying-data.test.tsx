import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"

import type {
  GapGroup,
  PayMappingSnapshotRow,
  WomenDominatedGroupWire,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { WomenDominatedUnderlyingData } from "@/components/pay-mapping/women-dominated-underlying-data"
import { makeGapGroup } from "@/test/pay-mapping-fixtures"

const m = messages.dashboard.payMapping
const tHelp = messages.dashboard.help

const REFERENCE_DATE_MS = Date.UTC(2026, 6, 1)

function renderUnderlyingData(
  props: Parameters<typeof WomenDominatedUnderlyingData>[0]
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WomenDominatedUnderlyingData {...props} />
    </NextIntlClientProvider>
  )
}

const COMPARATOR_ROW_A: PayMappingSnapshotRow = {
  displayName: "Tom Tech",
  erased: false,
  gender: "Man",
  roleTitle: "Technician",
  trackKey: "IC",
  seniority: "Mid",
  level: 3,
  basicMonthly: 44000,
  components: [],
  currency: "SEK",
  payYear: 2026,
}

const DOMINATED_ROW: PayMappingSnapshotRow = {
  displayName: "Nina Nurse",
  erased: false,
  gender: "Kvinna",
  roleTitle: "Nurse",
  trackKey: "IC",
  seniority: "Senior",
  level: 3,
  basicMonthly: 40000,
  components: [],
  currency: "SEK",
  payYear: 2026,
}

const WOMEN_DOMINATED_GROUP: WomenDominatedGroupWire = {
  key: "nurse|senior",
  roleTitle: "Nurse",
  seniority: "Senior",
  level: 3,
  headcount: 4,
  womenSharePct: 90,
  meanComp: 40000,
  comparisons: [
    {
      key: "technician|mid",
      roleTitle: "Technician",
      seniority: "Mid",
      level: 3,
      headcount: 3,
      womenSharePct: 25,
      meanComp: 44000,
      diffPct: 10,
      diffSek: 4000,
    },
  ],
}

const EQUIVALENT_WORK_LEVELS: GapGroup[] = [
  makeGapGroup({
    key: "level-3",
    roleTitle: null,
    seniority: null,
    level: 3,
    womenCount: 4,
    menCount: 4,
  }),
]

describe("WomenDominatedUnderlyingData", () => {
  afterEach(() => {
    cleanup()
  })

  it("is collapsed by default: the trigger renders but the comparison table does not", () => {
    renderUnderlyingData({
      group: WOMEN_DOMINATED_GROUP,
      equivalentWork: EQUIVALENT_WORK_LEVELS,
      rows: [DOMINATED_ROW, COMPARATOR_ROW_A],
      currency: "SEK",
      referenceDateMs: REFERENCE_DATE_MS,
    })
    const trigger = screen.getByRole("button", {
      name: m.review.showUnderlyingData,
    })
    expect(trigger.getAttribute("data-panel-open")).toBeNull()
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.queryByText("Technician · Mid")).toBeNull()
  })

  it("expands to show the full comparison table, the level-context sentence with its help button, and the scoped scatter", async () => {
    renderUnderlyingData({
      group: WOMEN_DOMINATED_GROUP,
      equivalentWork: EQUIVALENT_WORK_LEVELS,
      rows: [DOMINATED_ROW, COMPARATOR_ROW_A],
      currency: "SEK",
      referenceDateMs: REFERENCE_DATE_MS,
    })
    fireEvent.click(
      screen.getByRole("button", { name: m.review.showUnderlyingData })
    )

    await waitFor(() => {
      expect(screen.getByRole("table")).toBeDefined()
    })
    expect(screen.getByText("Technician · Mid")).toBeDefined()
    expect(screen.getByText("10%")).toBeDefined() // the comparator's diff%
    // The level-context sentence reads the level's BASE metric (ADR-0015).
    expect(
      screen.getByText("Within level 3, women earn 10% less than men.")
    ).toBeDefined()
    expect(
      screen.getByRole("button", { name: tHelp.payGapEquivalentWorkLabel })
    ).toBeDefined()
    expect(screen.getByText(m.scatter.titleEquivalentWork)).toBeDefined()
  })

  it("shows the no-comparators message instead of an empty table when nothing out-earns the group", async () => {
    renderUnderlyingData({
      group: { ...WOMEN_DOMINATED_GROUP, comparisons: [] },
      equivalentWork: [],
      rows: [DOMINATED_ROW],
      currency: "SEK",
      referenceDateMs: REFERENCE_DATE_MS,
    })
    fireEvent.click(
      screen.getByRole("button", { name: m.review.showUnderlyingData })
    )

    await waitFor(() => {
      expect(screen.getByText(m.gap.noComparators)).toBeDefined()
    })
    expect(screen.queryByRole("table")).toBeNull()
  })
})
