import { describe, expect, it } from "vitest"
import { docFrontmatterSchema } from "./frontmatter"

describe("docFrontmatterSchema", () => {
  it("accepts the midday-shaped frontmatter", () => {
    expect(
      docFrontmatterSchema.parse({
        title: "Introduction",
        description: "What blueprnt is.",
        section: "getting-started",
      })
    ).toEqual({
      title: "Introduction",
      description: "What blueprnt is.",
      section: "getting-started",
    })
  })

  it("rejects a missing description", () => {
    expect(() =>
      docFrontmatterSchema.parse({ title: "X", section: "s" })
    ).toThrow()
  })

  it("rejects unknown keys so frontmatter stays midday-minimal", () => {
    expect(() =>
      docFrontmatterSchema.parse({
        title: "X",
        description: "Y",
        section: "s",
        draft: true,
      })
    ).toThrow()
  })
})
