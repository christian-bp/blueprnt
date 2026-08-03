import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { MAX_FAMILIES, MAX_ROLES } from "@workspace/constants"
import { describe, expect, it } from "vitest"

import type { DraftFamily } from "@/lib/family-dnd"
import { resolveImportTargets } from "@/lib/role-import"

const ENG = "fam_eng" as Id<"roleFamilies">
const SALES = "fam_sales" as Id<"roleFamilies">

const EXISTING_FAMILIES = [
  { familyId: ENG, name: "Engineering" },
  { familyId: SALES, name: "Sales" },
]

const EXISTING_ROLES = [
  { title: "Developer", familyId: ENG },
  { title: "Account Executive", familyId: SALES },
  // A family-less role must never make a NEW family's title look duplicated.
  { title: "Legal Counsel", familyId: null },
]

function draft(families: DraftFamily[]): DraftFamily[] {
  return families
}

describe("resolveImportTargets", () => {
  it("matches an existing family by name, case-insensitively", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "engineering",
          roles: [{ id: 2, title: "SRE", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families[0]?.familyId).toBe(ENG)
    expect(result.payload).toEqual([
      {
        familyId: ENG,
        name: "engineering",
        roles: [{ title: "SRE", trackKey: "IC" }],
      },
    ])
    expect(result.counts).toEqual({ roles: 1, families: 0, skipped: 0 })
  })

  it("treats an unmatched name as a new family", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Legal",
          roles: [{ id: 2, title: "Counsel", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families[0]?.familyId).toBeNull()
    expect(result.payload).toEqual([
      { name: "Legal", roles: [{ title: "Counsel", trackKey: "IC" }] },
    ])
    expect(result.counts).toEqual({ roles: 1, families: 1, skipped: 0 })
  })

  it("flags a title already taken in the matched family and drops it from the payload", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Engineering",
          roles: [
            { id: 2, title: " developer ", trackKey: "IC" },
            { id: 3, title: "SRE", trackKey: "IC" },
          ],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families[0]?.roles.map((role) => role.duplicate)).toEqual([
      true,
      false,
    ])
    expect(result.payload[0]?.roles).toEqual([{ title: "SRE", trackKey: "IC" }])
    expect(result.counts.skipped).toBe(1)
  })

  it("does not flag a new family's title against a family-less role", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Legal",
          roles: [{ id: 2, title: "Legal Counsel", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families[0]?.roles[0]?.duplicate).toBe(false)
  })

  it("flags a duplicate inside one card", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Legal",
          roles: [
            { id: 2, title: "Counsel", trackKey: "IC" },
            { id: 3, title: "COUNSEL", trackKey: "Lead" },
          ],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families[0]?.roles.map((role) => role.duplicate)).toEqual([
      false,
      true,
    ])
    expect(result.counts).toEqual({ roles: 1, families: 1, skipped: 1 })
  })

  it("flags a duplicate across two cards that resolve to the SAME existing family", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Engineering",
          roles: [{ id: 2, title: "SRE", trackKey: "IC" }],
        },
        {
          id: 3,
          name: "engineering",
          roles: [{ id: 4, title: "sre", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families[1]?.roles[0]?.duplicate).toBe(true)
    expect(result.counts.roles).toBe(1)
  })

  it("marks BOTH new families when two of them claim one name, and blocks create", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Legal",
          roles: [{ id: 2, title: "Counsel", trackKey: "IC" }],
        },
        {
          id: 3,
          name: "legal",
          roles: [{ id: 4, title: "Paralegal", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families.map((family) => family.colliding)).toEqual([
      true,
      true,
    ])
    expect(result.payload).toEqual([])
    expect(result.canCreate).toBe(false)
  })

  it("ignores blank names and blank titles without flagging them", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "  ",
          roles: [{ id: 2, title: "Counsel", trackKey: "IC" }],
        },
        {
          id: 3,
          name: "Legal",
          roles: [{ id: 4, title: "   ", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families.every((family) => !family.colliding)).toBe(true)
    expect(result.families[1]?.roles[0]?.duplicate).toBe(false)
    expect(result.payload).toEqual([])
    expect(result.canCreate).toBe(false)
  })

  it("cannot create when every proposed role already exists", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Engineering",
          roles: [{ id: 2, title: "Developer", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.canCreate).toBe(false)
    expect(result.blocker).toBe("allDuplicate")
    expect(result.counts).toEqual({ roles: 0, families: 0, skipped: 1 })
  })

  // The review's explanatory line renders off `blocker`, so these pin the
  // reason and not just the gate: a draft blocked on a card must never be
  // reported as "every role already exists", which points at the wrong fix.
  it("blames the card, not duplicates, when a card is missing its name", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          // The only card, its name cleared by the user. Its roles are all
          // fresh, so nothing here is a duplicate at all.
          name: "",
          roles: [{ id: 2, title: "Counsel", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.canCreate).toBe(false)
    expect(result.blocker).toBe("cardBlocked")
  })

  it("blames the card even when its every role IS a duplicate", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Engineering",
          roles: [{ id: 2, title: "Developer", trackKey: "IC" }],
        },
        {
          id: 3,
          name: "   ",
          roles: [{ id: 4, title: "Counsel", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    // The naming problem is the one the user can act on, and its card already
    // says so; adding "every role already exists" beside it would be false.
    expect(result.blocker).toBe("cardBlocked")
  })

  it("blames the collision, not duplicates, when two new cards share a name", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Legal",
          roles: [{ id: 2, title: "Counsel", trackKey: "IC" }],
        },
        {
          id: 3,
          name: "legal",
          roles: [{ id: 4, title: "Paralegal", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.blocker).toBe("cardBlocked")
  })

  it("reports an emptied draft as empty, not as every role already existing", () => {
    const removedEveryCard = resolveImportTargets(
      draft([]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(removedEveryCard.canCreate).toBe(false)
    expect(removedEveryCard.blocker).toBe("empty")

    // A named card whose rows are all blank is the same story: there is no
    // role on screen for "already exists" to be about.
    const blankRows = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Legal",
          roles: [{ id: 2, title: "  ", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(blankRows.blocker).toBe("empty")
  })

  it("reports no blocker on the happy path", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Engineering",
          roles: [{ id: 2, title: "SRE", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.blocker).toBeNull()
  })

  it("can create on a straightforward happy path", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Engineering",
          roles: [{ id: 2, title: "SRE", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.canCreate).toBe(true)
  })

  it("gives each new family its own fresh set, so two DIFFERENT new families can share one title", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Legal",
          roles: [{ id: 2, title: "Counsel", trackKey: "IC" }],
        },
        {
          id: 3,
          name: "Finance",
          roles: [{ id: 4, title: "Counsel", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    // A future accidental hoist of the new-family Set outside the per-card
    // loop would make the second card see the first card's title as taken.
    expect(result.families.map((family) => family.roles[0]?.duplicate)).toEqual(
      [false, false]
    )
    expect(result.counts).toEqual({ roles: 2, families: 2, skipped: 0 })
    expect(result.canCreate).toBe(true)
  })

  it("flags nameMissing only when a blank-named card holds a real title, and blocks canCreate", () => {
    const withRole = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "   ",
          roles: [{ id: 2, title: "Counsel", trackKey: "IC" }],
        },
        {
          id: 3,
          name: "Finance",
          roles: [{ id: 4, title: "Analyst", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(withRole.families[0]?.nameMissing).toBe(true)
    // The OTHER card still resolves and would create fine on its own, so
    // this proves canCreate is blocked BY nameMissing, not by a lack of
    // anything to create.
    expect(withRole.counts.roles).toBe(1)
    expect(withRole.canCreate).toBe(false)

    const empty = resolveImportTargets(
      draft([{ id: 1, name: "   ", roles: [] }]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(empty.families[0]?.nameMissing).toBe(false)
  })

  // The server rejects the WHOLE payload over a limit, with one untargeted
  // invalidInput and no way to find the offending row among a hundred. The
  // resolver has to hold the same line the write does, or the review hands the
  // user a dead end whose only exit discards the reviewed list.
  describe("size limits", () => {
    // One card is enough to break the role cap and keeps the family count low,
    // so this isolates MAX_ROLES from MAX_FAMILIES.
    const oneCardWith = (count: number): DraftFamily[] => [
      {
        id: 1,
        name: "Engineering",
        roles: Array.from({ length: count }, (_, index) => ({
          id: index + 100,
          title: `Role ${index}`,
          trackKey: "IC",
        })),
      },
    ]

    it("allows exactly the maximum number of roles", () => {
      const result = resolveImportTargets(
        draft(oneCardWith(MAX_ROLES)),
        EXISTING_FAMILIES,
        EXISTING_ROLES
      )
      expect(result.counts.roles).toBe(MAX_ROLES)
      expect(result.blocker).toBeNull()
      expect(result.canCreate).toBe(true)
    })

    it("blocks one role past the maximum, and says which limit", () => {
      const result = resolveImportTargets(
        draft(oneCardWith(MAX_ROLES + 1)),
        EXISTING_FAMILIES,
        EXISTING_ROLES
      )
      expect(result.blocker).toBe("tooManyRoles")
      expect(result.canCreate).toBe(false)
    })

    const cards = (count: number): DraftFamily[] =>
      Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        name: `Family ${index}`,
        roles: [{ id: index + 1000, title: `Role ${index}`, trackKey: "IC" }],
      }))

    it("allows exactly the maximum number of families", () => {
      const result = resolveImportTargets(
        draft(cards(MAX_FAMILIES)),
        EXISTING_FAMILIES,
        EXISTING_ROLES
      )
      expect(result.blocker).toBeNull()
      expect(result.canCreate).toBe(true)
    })

    it("blocks one family past the maximum, and says which limit", () => {
      const result = resolveImportTargets(
        draft(cards(MAX_FAMILIES + 1)),
        EXISTING_FAMILIES,
        EXISTING_ROLES
      )
      expect(result.blocker).toBe("tooManyFamilies")
      expect(result.canCreate).toBe(false)
    })

    // The limits are what the SERVER counts, which is the payload: a row that
    // is never submitted must not push a legal import over the line.
    it("counts the payload, not the rows on screen", () => {
      const overCapOnScreen = oneCardWith(MAX_ROLES)
      const engineering = overCapOnScreen[0]
      if (engineering === undefined) throw new Error("no card")
      // Two extra rows that resolve to nothing: one blank, one already taken.
      engineering.roles.push(
        { id: 5000, title: "   ", trackKey: "IC" },
        { id: 5001, title: "Developer", trackKey: "IC" }
      )
      const result = resolveImportTargets(
        draft(overCapOnScreen),
        EXISTING_FAMILIES,
        EXISTING_ROLES
      )
      expect(result.counts.roles).toBe(MAX_ROLES)
      expect(result.blocker).toBeNull()
      expect(result.canCreate).toBe(true)
    })
  })

  // The row still sits there looking like a role while the CTA's count quietly
  // drops it, so the resolver has to hand the view something to say about it.
  it("flags a titleless row instead of dropping it silently", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Legal",
          roles: [
            { id: 2, title: "Counsel", trackKey: "IC" },
            { id: 3, title: "   ", trackKey: "IC" },
          ],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families[0]?.roles.map((role) => role.blank)).toEqual([
      false,
      true,
    ])
    // Blank is not a duplicate: the two notes must not both fire on one row.
    expect(result.families[0]?.roles.map((role) => role.duplicate)).toEqual([
      false,
      false,
    ])
    expect(result.counts.roles).toBe(1)
  })

  // Nothing from a blocked card is submitted, so "already exists, will be
  // skipped" on its rows names a consequence that will not happen and points
  // at the wrong fix (edit the title, when the card's name is the problem).
  it("does not label rows of a blocked card as duplicates", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "",
          roles: [
            { id: 2, title: "Counsel", trackKey: "IC" },
            { id: 3, title: "counsel", trackKey: "IC" },
          ],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families[0]?.nameMissing).toBe(true)
    expect(result.families[0]?.roles.every((role) => !role.duplicate)).toBe(
      true
    )
    expect(result.counts.skipped).toBe(0)
  })

  it("does not label a duplicate inside a name-colliding card either", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Legal",
          roles: [
            { id: 2, title: "Counsel", trackKey: "IC" },
            { id: 3, title: "COUNSEL", trackKey: "IC" },
          ],
        },
        {
          id: 4,
          name: "legal",
          roles: [{ id: 5, title: "Paralegal", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families[0]?.roles.every((role) => !role.duplicate)).toBe(
      true
    )
  })

  // An empty card cannot contribute a name to the payload, so the server never
  // sees it and cannot reject it. Counting it blocked the whole import over a
  // card that does not exist as far as the write is concerned.
  it("ignores an empty added card when detecting a name collision", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Legal",
          roles: [{ id: 2, title: "Counsel", trackKey: "IC" }],
        },
        // Added by the user and named, but holding nothing.
        { id: 3, name: "Legal", roles: [] },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families.map((family) => family.colliding)).toEqual([
      false,
      false,
    ])
    expect(result.canCreate).toBe(true)
    expect(result.counts).toEqual({ roles: 1, families: 1, skipped: 0 })
  })

  it("still collides two cards that both hold real titles", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Legal",
          roles: [{ id: 2, title: "Counsel", trackKey: "IC" }],
        },
        {
          id: 3,
          name: "Legal",
          // Blank rows only: nothing to submit, so no collision.
          roles: [{ id: 4, title: "  ", trackKey: "IC" }],
        },
        {
          id: 5,
          name: "Finance",
          roles: [{ id: 6, title: "Analyst", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families.map((family) => family.colliding)).toEqual([
      false,
      false,
      false,
    ])
    expect(result.canCreate).toBe(true)
  })

  it("does not attribute a colliding card's internal duplicate to counts.skipped", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Legal",
          roles: [
            { id: 2, title: "Counsel", trackKey: "IC" },
            { id: 3, title: "COUNSEL", trackKey: "IC" },
          ],
        },
        {
          id: 4,
          name: "legal",
          roles: [{ id: 5, title: "Paralegal", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families.map((family) => family.colliding)).toEqual([
      true,
      true,
    ])
    // The real reason nothing lands is the name collision, not the internal
    // duplicate: neither card is submitted, so skipped stays 0.
    expect(result.counts).toEqual({ roles: 0, families: 0, skipped: 0 })
    expect(result.canCreate).toBe(false)
  })
})

// buildImportSeed drops a proposed role the target family already holds before
// the review ever renders it, so those rows are not in the draft and this pass
// cannot see them. They are still skips of the same kind, and the count the
// seed hands over is the only place they survive.
describe("resolveImportTargets with rows skipped before the review", () => {
  it("adds the seed's drops to counts.skipped", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Engineering",
          roles: [{ id: 2, title: "SRE", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES,
      2
    )
    expect(result.counts).toEqual({ roles: 1, families: 0, skipped: 2 })
    expect(result.canCreate).toBe(true)
  })

  it("counts them alongside a duplicate the review itself marked", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Engineering",
          // Typed by hand into a family that already has it: the resolver is
          // the safety net for exactly this.
          roles: [{ id: 2, title: "Developer", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES,
      3
    )
    expect(result.counts.skipped).toBe(4)
  })

  // Without this the message under the CTA would fall through to "there is
  // nothing to add" whenever the AI proposed only roles the org already had,
  // which says nothing about why: the draft is genuinely empty of proposed
  // rows by then, because the seed removed every one of them.
  it("still reaches allDuplicate when the seed removed the entire proposal", () => {
    const result = resolveImportTargets(
      draft([{ id: 1, familyId: ENG, name: "Engineering", roles: [] }]),
      EXISTING_FAMILIES,
      EXISTING_ROLES,
      2
    )
    expect(result.blocker).toBe("allDuplicate")
    expect(result.canCreate).toBe(false)
  })

  it("still reports empty when nothing was skipped anywhere", () => {
    const result = resolveImportTargets(
      draft([{ id: 1, familyId: ENG, name: "Engineering", roles: [] }]),
      EXISTING_FAMILIES,
      EXISTING_ROLES,
      0
    )
    expect(result.blocker).toBe("empty")
  })

  it("defaults to nothing skipped before the review", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Engineering",
          roles: [{ id: 2, title: "SRE", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.counts.skipped).toBe(0)
  })
})
