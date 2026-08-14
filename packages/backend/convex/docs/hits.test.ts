import { describe, expect, it } from "vitest"
import { hitsFrom, type SearchResultLike } from "./hits"

const result = (
  metadata: Record<string, unknown> | undefined,
  ...texts: string[]
): SearchResultLike => ({
  content: texts.map((text, index) => ({
    text,
    ...(index === 0 ? { metadata } : {}),
  })),
})

describe("hitsFrom", () => {
  it("builds an anchored path from the chunk's own metadata", () => {
    expect(
      hitsFrom(
        [
          result(
            {
              slug: "glossary",
              anchor: "equal-work",
              heading: "Equal work",
              pageTitle: "Glossary",
            },
            "Equal work means..."
          ),
        ],
        false
      )
    ).toEqual([
      {
        pageTitle: "Glossary",
        heading: "Equal work",
        path: "/docs/glossary#equal-work",
        text: "Equal work means...",
      },
    ])
  })

  it("omits the anchor for a chunk that has none", () => {
    const [hit] = hitsFrom(
      [result({ slug: "introduction", anchor: null, pageTitle: "Intro" }, "x")],
      false
    )
    expect(hit?.path).toBe("/docs/introduction")
    expect(hit?.heading).toBeNull()
  })

  // The English fallback's anchors come from English headings, which do not
  // exist on the reader's translated page, so an anchored path would land
  // them at the top of the page with no explanation.
  it("suppresses the anchor on an English fallback hit", () => {
    const [hit] = hitsFrom(
      [
        result(
          { slug: "glossary", anchor: "equal-work", pageTitle: "Glossary" },
          "x"
        ),
      ],
      true
    )
    expect(hit?.path).toBe("/docs/glossary")
  })

  it("joins the chunk's context pieces into one excerpt", () => {
    const [hit] = hitsFrom(
      [result({ slug: "a", anchor: null, pageTitle: "A" }, "first", "second")],
      false
    )
    expect(hit?.text).toBe("first\nsecond")
  })

  // With chunkContext enabled the window opens on EARLIER chunks, so
  // content[0] is a preceding section. Taking its metadata would deep-link
  // the reader to the wrong heading with no error anywhere, which is why the
  // anchor is read at order - startOrder.
  it("takes the anchor from the chunk that matched, not the window's first chunk", () => {
    const [hit] = hitsFrom(
      [
        {
          order: 4,
          startOrder: 3,
          content: [
            {
              text: "preceding section",
              metadata: {
                slug: "glossary",
                anchor: "equivalent-work",
                pageTitle: "Glossary",
              },
            },
            {
              text: "the matched section",
              metadata: {
                slug: "glossary",
                anchor: "equal-work",
                heading: "Equal work",
                pageTitle: "Glossary",
              },
            },
          ],
        },
      ],
      false
    )
    expect(hit?.path).toBe("/docs/glossary#equal-work")
    expect(hit?.heading).toBe("Equal work")
  })

  it("drops a result with no slug rather than emitting an unlinkable excerpt", () => {
    expect(hitsFrom([result({ anchor: "x" }, "orphan")], false)).toEqual([])
    expect(hitsFrom([result(undefined, "orphan")], false)).toEqual([])
  })

  it("tolerates non-string metadata without throwing", () => {
    expect(
      hitsFrom([result({ slug: 42, anchor: {}, pageTitle: [] }, "x")], false)
    ).toEqual([])
  })
})
