import { slugify } from "@workspace/constants"

// The single anchor rule: renderer, chunker, and the link guard all call
// this. Docs headings are plain text by convention (guarded by guard 9 in
// docs-guards.test.ts, which fails on any heading with inline markdown), so
// plain string slugification is the whole rule.
export function headingAnchor(text: string): string {
  return slugify(text)
}

// Levels 2-4 are exactly the headings the MDX renderer gives an id to, so
// this is the one definition of "a heading a link can point at": the search
// index, the anchor guards, and the renderer must agree on the set or the
// palette offers anchors that do not exist. The h1 is the page title from
// frontmatter and is never written in the body.
const HEADING = /^#{2,4}\s+(.+)$/gm

// A fenced block is prose to the renderer, not structure: a "## ..." line
// inside one gets no id. Counting it as a heading would put a section in the
// palette whose anchor never exists, and a deep link to it lands silently at
// the top of the page. The corpus has no such heading today, which is exactly
// why this belongs in the shared rule rather than in a reviewer's memory.
const FENCE = /^(?:```|~~~)/

function outsideFences(body: string): string {
  let fenced = false
  return body
    .split("\n")
    .map((line) => {
      if (FENCE.test(line.trimStart())) {
        fenced = !fenced
        return ""
      }
      return fenced ? "" : line
    })
    .join("\n")
}

export function headingTexts(body: string): string[] {
  return [...outsideFences(body).matchAll(HEADING)].map(
    (match) => match[1] ?? ""
  )
}
