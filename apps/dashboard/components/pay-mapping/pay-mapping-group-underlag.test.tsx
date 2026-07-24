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

import { PayMappingGroupUnderlag } from "@/components/pay-mapping/pay-mapping-group-underlag"
import type {
  GapGroup,
  PayMappingSnapshotRow,
  WomenDominatedGroupWire,
} from "@/components/pay-mapping/pay-mapping-gap-types"

const m = messages.dashboard.payMapping
const tHelp = messages.dashboard.help

const REFERENCE_DATE_MS = Date.UTC(2026, 6, 1)

function renderUnderlag(props: Parameters<typeof PayMappingGroupUnderlag>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingGroupUnderlag {...props} />
    </NextIntlClientProvider>
  )
}

const EQUAL_WORK_GROUP: GapGroup = {
  key: "swe|senior",
  roleTitle: "SWE",
  level: "Senior",
  band: 3,
  womenCount: 1,
  menCount: 1,
  womenMeanComp: 90000,
  menMeanComp: 100000,
  gapPct: 10,
  flag: "elevated",
}

const EQUAL_WORK_ROWS: PayMappingSnapshotRow[] = [
  {
    displayName: "Anna Annan",
    erased: false,
    gender: "Kvinna",
    roleTitle: "SWE",
    trackKey: "IC",
    level: "Senior",
    band: 3,
    basicMonthly: 90000,
    components: [],
    currency: "SEK",
    payYear: 2026,
  },
  {
    displayName: "Bertil Berg",
    erased: false,
    gender: "Man",
    roleTitle: "SWE",
    trackKey: "IC",
    level: "Senior",
    band: 3,
    basicMonthly: 100000,
    components: [],
    currency: "SEK",
    payYear: 2026,
  },
  {
    displayName: "Not In Group",
    erased: false,
    gender: "Man",
    roleTitle: "Other",
    trackKey: "IC",
    level: "Junior",
    band: 1,
    basicMonthly: 50000,
    components: [],
    currency: "SEK",
    payYear: 2026,
  },
]

describe("PayMappingGroupUnderlag - equalWork", () => {
  afterEach(() => {
    cleanup()
  })

  it("is collapsed by default: the trigger renders but the member rows do not", () => {
    renderUnderlag({
      scope: "equalWork",
      group: EQUAL_WORK_GROUP,
      rows: EQUAL_WORK_ROWS,
      currency: "SEK",
      referenceDateMs: REFERENCE_DATE_MS,
    })
    const trigger = screen.getByRole("button", { name: m.review.showUnderlag })
    expect(trigger.getAttribute("data-panel-open")).toBeNull()
    expect(screen.queryByText("Anna Annan")).toBeNull()
    expect(screen.queryByText("Not In Group")).toBeNull()
  })

  it("shows the Empty state with an icon instead of an empty table when the group has no priced members", async () => {
    renderUnderlag({
      scope: "equalWork",
      group: { ...EQUAL_WORK_GROUP, roleTitle: "No Match", level: "None" },
      rows: EQUAL_WORK_ROWS,
      currency: "SEK",
      referenceDateMs: REFERENCE_DATE_MS,
    })
    fireEvent.click(screen.getByRole("button", { name: m.review.showUnderlag }))

    await waitFor(() => {
      expect(screen.getByText(m.gap.empty)).toBeDefined()
    })
    expect(screen.queryByRole("table")).toBeNull()
    expect(
      document.querySelector('[data-slot="empty-icon"] svg')
    ).not.toBeNull()
  })

  it("expands on click to show the group's own member table (scoped by groupMembers) and its scatter", async () => {
    renderUnderlag({
      scope: "equalWork",
      group: EQUAL_WORK_GROUP,
      rows: EQUAL_WORK_ROWS,
      currency: "SEK",
      referenceDateMs: REFERENCE_DATE_MS,
    })
    fireEvent.click(screen.getByRole("button", { name: m.review.showUnderlag }))

    await waitFor(() => {
      expect(screen.getByText("Anna Annan")).toBeDefined()
    })
    expect(screen.getByText("Bertil Berg")).toBeDefined()
    // The row from a different roleTitle/level/band is excluded by
    // groupMembers's scoping.
    expect(screen.queryByText("Not In Group")).toBeNull()
    // The scatter embed is scoped to the same member set. Its title
    // ("People in the group") shares its English copy with the member
    // table's own heading (gap.groupMembers), so both instances render.
    expect(screen.getAllByText(m.scatter.titleEqualWork)).toHaveLength(2)
    // The trigger's chevron reflects the open state.
    expect(
      screen
        .getByRole("button", { name: m.review.showUnderlag })
        .getAttribute("data-panel-open")
    ).not.toBeNull()
  })
})

const COMPARATOR_ROW_A: PayMappingSnapshotRow = {
  displayName: "Tom Tech",
  erased: false,
  gender: "Man",
  roleTitle: "Technician",
  trackKey: "IC",
  level: "Mid",
  band: 3,
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
  level: "Senior",
  band: 3,
  basicMonthly: 40000,
  components: [],
  currency: "SEK",
  payYear: 2026,
}

const WOMEN_DOMINATED_GROUP: WomenDominatedGroupWire = {
  key: "nurse|senior",
  roleTitle: "Nurse",
  level: "Senior",
  band: 3,
  headcount: 4,
  womenSharePct: 90,
  meanComp: 40000,
  comparisons: [
    {
      key: "technician|mid",
      roleTitle: "Technician",
      level: "Mid",
      band: 3,
      headcount: 3,
      womenSharePct: 25,
      meanComp: 44000,
      diffPct: 10,
      diffSek: 4000,
    },
  ],
}

const EQUIVALENT_WORK_BANDS: GapGroup[] = [
  {
    key: "band-3",
    roleTitle: null,
    level: null,
    band: 3,
    womenCount: 4,
    menCount: 4,
    womenMeanComp: 90000,
    menMeanComp: 100000,
    gapPct: 10,
    flag: "elevated",
  },
]

describe("PayMappingGroupUnderlag - equivalentWork", () => {
  afterEach(() => {
    cleanup()
  })

  it("is collapsed by default: the trigger renders but the comparison table does not", () => {
    renderUnderlag({
      scope: "equivalentWork",
      group: WOMEN_DOMINATED_GROUP,
      equivalentWork: EQUIVALENT_WORK_BANDS,
      rows: [DOMINATED_ROW, COMPARATOR_ROW_A],
      currency: "SEK",
      referenceDateMs: REFERENCE_DATE_MS,
    })
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.queryByText("Technician · Mid")).toBeNull()
  })

  it("expands to show the full comparison table, the band-context sentence with its help button, and the scoped scatter", async () => {
    renderUnderlag({
      scope: "equivalentWork",
      group: WOMEN_DOMINATED_GROUP,
      equivalentWork: EQUIVALENT_WORK_BANDS,
      rows: [DOMINATED_ROW, COMPARATOR_ROW_A],
      currency: "SEK",
      referenceDateMs: REFERENCE_DATE_MS,
    })
    fireEvent.click(screen.getByRole("button", { name: m.review.showUnderlag }))

    await waitFor(() => {
      expect(screen.getByRole("table")).toBeDefined()
    })
    expect(screen.getByText("Technician · Mid")).toBeDefined()
    expect(screen.getByText("10%")).toBeDefined() // the comparator's diff%
    expect(
      screen.getByText("Within band 3, women earn 10% less than men.")
    ).toBeDefined()
    expect(
      screen.getByRole("button", { name: tHelp.payGapEquivalentWorkLabel })
    ).toBeDefined()
    expect(screen.getByText(m.scatter.titleEquivalentWork)).toBeDefined()
  })

  it("shows the no-comparators message instead of an empty table when nothing out-earns the group", async () => {
    renderUnderlag({
      scope: "equivalentWork",
      group: { ...WOMEN_DOMINATED_GROUP, comparisons: [] },
      equivalentWork: [],
      rows: [DOMINATED_ROW],
      currency: "SEK",
      referenceDateMs: REFERENCE_DATE_MS,
    })
    fireEvent.click(screen.getByRole("button", { name: m.review.showUnderlag }))

    await waitFor(() => {
      expect(screen.getByText(m.gap.noComparators)).toBeDefined()
    })
    expect(screen.queryByRole("table")).toBeNull()
  })
})
