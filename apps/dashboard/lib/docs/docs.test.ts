import { describe, expect, it } from "vitest"
import { getAdjacentDocs, getDoc } from "./docs"
import { allDocSlugs, DOCS_NAV, SECTION_LABEL_KEYS } from "./docs-nav"

describe("docs nav structure", () => {
  it("flattens slugs in nav order and has a label key per section", () => {
    const slugs = allDocSlugs()
    expect(slugs.length).toBeGreaterThan(0)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of DOCS_NAV) {
      expect(SECTION_LABEL_KEYS[s.section]).toBeDefined()
    }
  })
})

describe("getDoc", () => {
  it("returns null for a slug that is not in the nav (URL safety)", async () => {
    expect(await getDoc("en", "../../../etc/passwd")).toBeNull()
    expect(await getDoc("en", "does-not-exist")).toBeNull()
  })

  it("loads a seed page with parsed frontmatter and body", async () => {
    const doc = await getDoc("en", "introduction")
    expect(doc).not.toBeNull()
    expect(doc?.frontmatter.section).toBe("getting-started")
    expect(doc?.body).toContain("#")
  })
})

describe("getAdjacentDocs", () => {
  it("walks the flattened nav order with null at the ends", () => {
    const slugs = allDocSlugs()
    expect(getAdjacentDocs(slugs[0] ?? "").previous).toBeNull()
    expect(getAdjacentDocs(slugs.at(-1) ?? "").next).toBeNull()
    if (slugs.length >= 2) {
      expect(getAdjacentDocs(slugs[0] ?? "").next).toBe(slugs[1])
    }
  })
})
