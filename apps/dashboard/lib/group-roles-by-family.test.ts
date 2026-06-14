import { describe, expect, it } from "vitest"

import { groupRowsByFamily } from "@/lib/group-roles-by-family"

type Row = {
  title: string
  familyId: string | null
  familyName: string | null
}
const row = (
  title: string,
  familyId: string | null,
  familyName: string | null
): Row => ({ title, familyId, familyName })

describe("groupRowsByFamily", () => {
  it("groups rows by family and orders families A-Z", () => {
    const groups = groupRowsByFamily(
      [
        row("Account Manager", "f-sales", "Sales"),
        row("Backend Engineer", "f-eng", "Engineering"),
        row("Frontend Engineer", "f-eng", "Engineering"),
      ],
      "en"
    )
    expect(groups.map((group) => group.familyName)).toEqual([
      "Engineering",
      "Sales",
    ])
    expect(groups[0]?.rows.map((r) => r.title)).toEqual([
      "Backend Engineer",
      "Frontend Engineer",
    ])
  })

  it("places family-less rows in a single trailing null group", () => {
    const groups = groupRowsByFamily(
      [
        row("Loner", null, null),
        row("Backend Engineer", "f-eng", "Engineering"),
        row("Drifter", null, null),
      ],
      "en"
    )
    expect(groups.map((group) => group.familyName)).toEqual([
      "Engineering",
      null,
    ])
    expect(groups[1]?.rows.map((r) => r.title)).toEqual(["Loner", "Drifter"])
  })

  it("returns a single null group when no row has a family", () => {
    const groups = groupRowsByFamily(
      [row("A", null, null), row("B", null, null)],
      "en"
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.familyName).toBeNull()
  })

  it("preserves the incoming row order within a family", () => {
    const groups = groupRowsByFamily(
      [row("Second", "f", "Fam"), row("First", "f", "Fam")],
      "en"
    )
    expect(groups[0]?.rows.map((r) => r.title)).toEqual(["Second", "First"])
  })
})
