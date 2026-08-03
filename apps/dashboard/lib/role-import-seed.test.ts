import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { describe, expect, it } from "vitest"

import { type ExistingRole, resolveImportTargets } from "@/lib/role-import"
import { buildImportSeed } from "@/lib/role-import-seed"

const ENG = "fam_eng" as Id<"roleFamilies">
const SALES = "fam_sales" as Id<"roleFamilies">
const LEGAL = "fam_legal" as Id<"roleFamilies">

const EXISTING_FAMILIES = [
  { familyId: SALES, name: "Sales" },
  { familyId: ENG, name: "Engineering" },
  { familyId: LEGAL, name: "Legal" },
]

const NO_ROLES: ExistingRole[] = []

describe("buildImportSeed", () => {
  it("carries the real id and the stored name onto a matched family", () => {
    const seed = buildImportSeed(
      [{ name: "engineering", roles: [{ title: "SRE", trackKey: "IC" }] }],
      EXISTING_FAMILIES,
      NO_ROLES,
      "en"
    )
    expect(seed.families[0]).toEqual({
      familyId: ENG,
      name: "Engineering",
      roles: [{ title: "SRE", trackKey: "IC" }],
    })
  })

  it("leaves a family the org does not have as a plain new one", () => {
    const seed = buildImportSeed(
      [{ name: "Finance", roles: [{ title: "Controller", trackKey: "IC" }] }],
      EXISTING_FAMILIES,
      NO_ROLES,
      "en"
    )
    expect(seed.families[0]?.familyId).toBeUndefined()
    expect(seed.families[0]?.name).toBe("Finance")
  })

  it("puts the targeted families first in the AI's order, the rest after alphabetically", () => {
    const seed = buildImportSeed(
      [
        { name: "Sales", roles: [{ title: "AE", trackKey: "IC" }] },
        { name: "Finance", roles: [{ title: "Controller", trackKey: "IC" }] },
      ],
      EXISTING_FAMILIES,
      NO_ROLES,
      "en"
    )
    // Sales and Finance are what is changing, in the order proposed; the two
    // families nothing is being added to follow, sorted by name.
    expect(seed.families.map((family) => family.name)).toEqual([
      "Sales",
      "Finance",
      "Engineering",
      "Legal",
    ])
  })

  it("injects every untargeted family with no roles, carrying its id", () => {
    const seed = buildImportSeed(
      [{ name: "Engineering", roles: [{ title: "SRE", trackKey: "IC" }] }],
      EXISTING_FAMILIES,
      NO_ROLES,
      "en"
    )
    expect(seed.families.slice(1)).toEqual([
      { familyId: LEGAL, name: "Legal", roles: [] },
      { familyId: SALES, name: "Sales", roles: [] },
    ])
  })

  it("injects nothing when the proposal already targets the whole register", () => {
    const seed = buildImportSeed(
      EXISTING_FAMILIES.map((family) => ({
        name: family.name,
        roles: [{ title: `${family.name} lead`, trackKey: "IC" }],
      })),
      EXISTING_FAMILIES,
      NO_ROLES,
      "en"
    )
    expect(seed.families).toHaveLength(3)
  })

  it("seeds only the proposal when the org has no families yet", () => {
    const seed = buildImportSeed(
      [{ name: "Engineering", roles: [{ title: "SRE", trackKey: "IC" }] }],
      [],
      NO_ROLES,
      "en"
    )
    expect(seed.families).toEqual([
      { name: "Engineering", roles: [{ title: "SRE", trackKey: "IC" }] },
    ])
  })

  // The whole register in the draft must be invisible to the write. A family
  // with no roles contributes neither a payload entry nor a count, so the
  // resolver needs no knowledge of the injection at all; if this ever fails,
  // the injection has leaked into what gets created.
  it("adds nothing to the payload or the counts", () => {
    const seed = buildImportSeed(
      [{ name: "Engineering", roles: [{ title: "SRE", trackKey: "IC" }] }],
      EXISTING_FAMILIES,
      NO_ROLES,
      "en"
    )
    const resolved = resolveImportTargets(
      seed.families.map((family, index) => ({
        id: index * 10,
        ...(family.familyId !== undefined ? { familyId: family.familyId } : {}),
        name: family.name,
        roles: family.roles.map((role, roleIndex) => ({
          id: index * 10 + roleIndex + 1,
          title: role.title,
          trackKey: role.trackKey,
        })),
      })),
      EXISTING_FAMILIES,
      []
    )
    expect(resolved.payload).toEqual([
      {
        familyId: ENG,
        name: "Engineering",
        roles: [{ title: "SRE", trackKey: "IC" }],
      },
    ])
    expect(resolved.counts).toEqual({ roles: 1, families: 0, skipped: 0 })
    expect(resolved.canCreate).toBe(true)
  })
})

describe("buildImportSeed duplicate filtering", () => {
  // The whole point: a proposal to add a role the family already has is a
  // proposal to do nothing, so it never becomes a row. The review used to show
  // it faded, directly under the identical row the family already had.
  it("drops a proposed role the target family already holds", () => {
    const seed = buildImportSeed(
      [
        {
          name: "Engineering",
          roles: [
            { title: "SRE", trackKey: "IC" },
            { title: "Developer", trackKey: "IC" },
          ],
        },
      ],
      EXISTING_FAMILIES,
      [{ title: "Developer", familyId: ENG }],
      "en"
    )
    expect(seed.families[0]?.roles).toEqual([{ title: "SRE", trackKey: "IC" }])
    expect(seed.skipped).toBe(1)
  })

  it("matches the existing title case-insensitively and ignoring surrounding space", () => {
    const seed = buildImportSeed(
      [
        {
          name: "Engineering",
          roles: [{ title: "  developer ", trackKey: "IC" }],
        },
      ],
      EXISTING_FAMILIES,
      [{ title: "Developer", familyId: ENG }],
      "en"
    )
    expect(seed.families[0]?.roles).toEqual([])
    expect(seed.skipped).toBe(1)
  })

  // Duplicate-ness is scoped to the family the role is going into, exactly as
  // the resolver scopes it: the same title in another family is a different
  // role, and a role filed under no family is in nobody's scope.
  it("keeps a title that exists only in another family, or in none", () => {
    const seed = buildImportSeed(
      [
        {
          name: "Engineering",
          roles: [{ title: "Controller", trackKey: "IC" }],
        },
        { name: "Sales", roles: [{ title: "Floater", trackKey: "IC" }] },
      ],
      EXISTING_FAMILIES,
      [
        { title: "Controller", familyId: SALES },
        { title: "Floater", familyId: null },
      ],
      "en"
    )
    expect(seed.families[0]?.roles).toHaveLength(1)
    expect(seed.families[1]?.roles).toHaveLength(1)
    expect(seed.skipped).toBe(0)
  })

  // A family this import would CREATE holds nothing yet, so no title in it can
  // already exist however many roles the org has elsewhere.
  it("keeps every row of a family the import would create", () => {
    const seed = buildImportSeed(
      [{ name: "Finance", roles: [{ title: "Developer", trackKey: "IC" }] }],
      EXISTING_FAMILIES,
      [{ title: "Developer", familyId: ENG }],
      "en"
    )
    expect(seed.families[0]?.roles).toHaveLength(1)
    expect(seed.skipped).toBe(0)
  })

  // Every row filtered leaves the family itself standing: it is a family the
  // org has, so it belongs on screen either way, now with nothing proposed.
  it("leaves a fully duplicated family on the list with no proposed roles", () => {
    const seed = buildImportSeed(
      [
        {
          name: "Engineering",
          roles: [
            { title: "Developer", trackKey: "IC" },
            { title: "SRE", trackKey: "IC" },
          ],
        },
      ],
      EXISTING_FAMILIES,
      [
        { title: "Developer", familyId: ENG },
        { title: "SRE", familyId: ENG },
      ],
      "en"
    )
    expect(seed.families[0]).toEqual({
      familyId: ENG,
      name: "Engineering",
      roles: [],
    })
    expect(seed.skipped).toBe(2)
  })

  // The count is what keeps the done screen's "Already existed" honest: the
  // rows are gone from the draft, so nothing downstream can rediscover them.
  it("counts every dropped row across every family", () => {
    const seed = buildImportSeed(
      [
        {
          name: "Engineering",
          roles: [
            { title: "Developer", trackKey: "IC" },
            { title: "SRE", trackKey: "IC" },
          ],
        },
        { name: "Sales", roles: [{ title: "AE", trackKey: "IC" }] },
      ],
      EXISTING_FAMILIES,
      [
        { title: "Developer", familyId: ENG },
        { title: "AE", familyId: SALES },
      ],
      "en"
    )
    expect(seed.skipped).toBe(2)
    expect(seed.families[0]?.roles).toEqual([{ title: "SRE", trackKey: "IC" }])
    expect(seed.families[1]?.roles).toEqual([])
  })
})
