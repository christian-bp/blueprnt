import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  ROLE_COLOR_SLOTS,
  ROLE_OTHER_COLOR,
  roleColorAt,
  roleColorsFor,
} from "./role-palette"

describe("roleColorAt", () => {
  const slots = Array.from({ length: ROLE_COLOR_SLOTS }, (_, i) =>
    roleColorAt(i)
  )

  it("gives each slot its own hue, in a fixed order", () => {
    expect(new Set(slots).size).toBe(ROLE_COLOR_SLOTS)
    expect(slots[0]).toBe("var(--role-1)")
    expect(slots[ROLE_COLOR_SLOTS - 1]).toBe(`var(--role-${ROLE_COLOR_SLOTS})`)
  })

  // The rule the whole palette rests on: a hue is a claim of identity, so
  // reusing one for a seventh job would say two different jobs are the same
  // job. The seventh folds into the neutral instead of cycling.
  it("folds everything past the slots into the neutral rather than cycling", () => {
    expect(roleColorAt(ROLE_COLOR_SLOTS)).toBe(ROLE_OTHER_COLOR)
    expect(roleColorAt(ROLE_COLOR_SLOTS + 40)).toBe(ROLE_OTHER_COLOR)
    expect(roleColorAt(-1)).toBe(ROLE_OTHER_COLOR)
  })

  it("keeps the neutral off every named slot's hue", () => {
    expect(slots).not.toContain(ROLE_OTHER_COLOR)
  })
})

describe("roleColorsFor", () => {
  it("keys the hues by label, in the given order", () => {
    const colors = roleColorsFor(["Nurse", "IT Manager", "Analyst"])
    expect(colors.get("Nurse")).toBe("var(--role-1)")
    expect(colors.get("IT Manager")).toBe("var(--role-2)")
    expect(colors.get("Analyst")).toBe("var(--role-3)")
  })

  // A hue follows the entity, never its rank: dropping a job must not
  // repaint the ones that stay, or the reader's memory of "the green one" is
  // silently wrong on the next render.
  it("keeps a job's hue when the labels around it change", () => {
    const before = roleColorsFor(["Nurse", "IT Manager", "Analyst"])
    const after = roleColorsFor(["Nurse", "IT Manager"])
    expect(after.get("Nurse")).toBe(before.get("Nurse"))
    expect(after.get("IT Manager")).toBe(before.get("IT Manager"))
  })

  it("leaves the jobs past the last slot to the neutral", () => {
    const labels = Array.from({ length: ROLE_COLOR_SLOTS + 2 }, (_, i) =>
      String(i)
    )
    expect(roleColorsFor(labels).get(String(ROLE_COLOR_SLOTS))).toBe(
      ROLE_OTHER_COLOR
    )
  })
})

// Read from the stylesheet, for the same reason the gender tokens are: every
// call site references var(--role-N) and would keep passing while the build
// resolved it to nothing.
describe("role tokens", () => {
  const css = readFileSync(
    join(process.cwd(), "../../packages/ui/src/styles/globals.css"),
    "utf8"
  )
  const slots = Array.from({ length: ROLE_COLOR_SLOTS }, (_, i) => i + 1)

  it("declares every slot the palette can hand out", () => {
    for (const slot of slots) {
      expect(css).toMatch(new RegExp(`--role-${slot}:\\s*[^;]+;`))
    }
    expect(css).toMatch(/--role-other:\s*[^;]+;/)
  })

  it("registers every role token in @theme, or the build drops it", () => {
    for (const slot of slots) {
      expect(css).toContain(`--color-role-${slot}: var(--role-${slot});`)
    }
    expect(css).toContain("--color-role-other: var(--role-other);")
  })

  it("gives every slot its own ink", () => {
    const values = slots.map(
      (slot) => css.match(new RegExp(`--role-${slot}:\\s*([^;]+);`))?.[1]
    )
    expect(new Set(values).size).toBe(slots.length)
  })
})
