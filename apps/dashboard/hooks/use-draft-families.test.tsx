import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { useDraftFamilies } from "@/hooks/use-draft-families"

const SOURCE = [
  {
    name: "Engineering",
    roles: [
      { title: "Developer", trackKey: "IC" },
      { title: "Manager", trackKey: "Boss" },
    ],
  },
  { name: "Sales", roles: [{ title: "AE", trackKey: "IC" }] },
]

describe("useDraftFamilies", () => {
  afterEach(() => {
    cleanup()
  })

  it("seeds with unique ids across families and roles, mapping track keys", () => {
    const { result } = renderHook(() => useDraftFamilies())
    act(() =>
      result.current.seed(SOURCE, (key) => (key === "Boss" ? "IC" : key))
    )
    const families = result.current.families ?? []
    const ids = families.flatMap((family) => [
      family.id,
      ...family.roles.map((role) => role.id),
    ])
    expect(new Set(ids).size).toBe(ids.length)
    expect(families[0]?.roles[1]?.trackKey).toBe("IC")

    // claimId continues past the seeded ids.
    let claimed = -1
    act(() => {
      claimed = result.current.claimId()
    })
    expect(ids).not.toContain(claimed)
  })

  it("update receives the current list and clear resets to null", () => {
    const { result } = renderHook(() => useDraftFamilies())
    act(() => result.current.seed(SOURCE))
    act(() =>
      result.current.update((current) =>
        current.filter((family) => family.name !== "Sales")
      )
    )
    expect(result.current.families?.map((family) => family.name)).toEqual([
      "Engineering",
    ])
    act(() => result.current.clear())
    expect(result.current.families).toBeNull()
  })

  it("cleaned trims and drops blank entries", () => {
    const { result } = renderHook(() => useDraftFamilies())
    act(() =>
      result.current.seed([
        { name: "  Engineering ", roles: [{ title: " Dev ", trackKey: "IC" }] },
        { name: "   ", roles: [] },
      ])
    )
    expect(result.current.cleaned()).toEqual([
      { name: "Engineering", roles: [{ title: "Dev", trackKey: "IC" }] },
    ])
  })

  it("cleanedWithIds carries seeded ids and omits them for new rows", () => {
    const { result } = renderHook(() => useDraftFamilies())
    // Seed an existing family (with ids), then add a brand-new role without one.
    act(() =>
      result.current.seed([
        {
          // biome-ignore lint/suspicious/noExplicitAny: test ids stand in for branded Convex ids.
          familyId: "fam-1" as any,
          name: "Engineering",
          // biome-ignore lint/suspicious/noExplicitAny: test ids stand in for branded Convex ids.
          roles: [{ roleId: "role-1" as any, title: "Dev", trackKey: "IC" }],
        },
      ])
    )
    let newId = -1
    act(() => {
      newId = result.current.claimId()
    })
    act(() =>
      result.current.update((current) =>
        current.map((family) => ({
          ...family,
          // A newly-added row: no roleId, so reconcile treats it as new.
          roles: [...family.roles, { id: newId, title: "New", trackKey: "IC" }],
        }))
      )
    )
    expect(result.current.cleanedWithIds()).toEqual([
      {
        familyId: "fam-1",
        name: "Engineering",
        roles: [
          { roleId: "role-1", title: "Dev", trackKey: "IC" },
          { title: "New", trackKey: "IC" },
        ],
      },
    ])
  })
})
