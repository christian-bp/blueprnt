import { describe, expect, it } from "vitest"
import { parseMdx } from "./parse-mdx"

describe("parseMdx", () => {
  it("parses a normal frontmatter block into data + body", () => {
    const raw = ["---", "title: Hello", "order: 1", "---", "", "# Body"].join(
      "\n"
    )
    const { data, content } = parseMdx(raw)
    expect(data).toEqual({ title: "Hello", order: 1 })
    expect(content.trim()).toBe("# Body")
    expect(content).not.toContain("---")
  })

  it("returns {} and the full content when there is no frontmatter", () => {
    const raw = "# Just a body\n\nNo fence here."
    const { data, content } = parseMdx(raw)
    expect(data).toEqual({})
    expect(content).toBe(raw)
  })

  it("handles CRLF line endings", () => {
    const raw = ["---", "title: Hello", "---", "", "# Body"].join("\r\n")
    const { data, content } = parseMdx(raw)
    expect(data).toEqual({ title: "Hello" })
    expect(content.trim()).toBe("# Body")
    expect(content).not.toContain("---")
  })

  it("parses a YAML value containing a colon inside quotes", () => {
    const raw = ["---", 'title: "Ratio: 1:2"', "---", "Body"].join("\n")
    const { data, content } = parseMdx(raw)
    expect(data).toEqual({ title: "Ratio: 1:2" })
    expect(content).toBe("Body")
  })

  it("does not truncate a body that itself contains a thematic break", () => {
    const raw = [
      "---",
      "title: Hello",
      "---",
      "",
      "Above",
      "",
      "---",
      "",
      "Below",
    ].join("\n")
    const { data, content } = parseMdx(raw)
    expect(data).toEqual({ title: "Hello" })
    expect(content.trim()).toBe("Above\n\n---\n\nBelow")
  })
})
