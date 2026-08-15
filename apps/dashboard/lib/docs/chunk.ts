import { headingAnchor } from "./anchors"
import type { DocFrontmatter } from "./frontmatter"

// Bumped whenever stripMarkdown or split rules change, forcing full resync.
export const CHUNKER_VERSION = "6"

export interface DocChunk {
  pageTitle: string
  heading: string | null
  anchor: string | null
  text: string
}

const MAX_CHUNK_CHARS = 2000

// Markdown to searchable plain text: link text survives, syntax does not.
function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^#{2,6}\s+/gm, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*>\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/^\s*[|-]+\s*$/gm, "")
    .replace(/^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim()
}

const LINK_ONLY_LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+\[[^\]]*\]\([^)]*\)\s*$/

// A section that is nothing but a list of bare links (e.g. a "Related"
// footer) is navigation, not content: stripMarkdown keeps link text but
// drops link syntax, so such a section would surface OTHER pages' titles
// under THIS page's path. Detected structurally, on the raw lines, so it
// works the same in every locale rather than matching a heading word.
function isLinkOnlyListSection(lines: string[]): boolean {
  const nonBlank = lines.filter((line) => line.trim() !== "")
  return (
    nonBlank.length > 0 &&
    nonBlank.every((line) => LINK_ONLY_LIST_ITEM.test(line))
  )
}

function splitLongParagraph(paragraph: string): string[] {
  if (paragraph.length <= MAX_CHUNK_CHARS) return [paragraph]
  const parts: string[] = []
  const words = paragraph.split(/\s+/)
  let current = ""
  for (const word of words) {
    if (current.length + word.length + 1 > MAX_CHUNK_CHARS) {
      if (current) parts.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) parts.push(current)
  return parts
}

function split(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text]
  const parts: string[] = []
  let current = ""
  for (const paragraph of text.split("\n\n")) {
    const longParts = splitLongParagraph(paragraph)
    for (const part of longParts) {
      if (
        current !== "" &&
        current.length + part.length + 2 > MAX_CHUNK_CHARS
      ) {
        parts.push(current)
        current = part
      } else {
        current = current === "" ? part : `${current}\n\n${part}`
      }
    }
  }
  if (current !== "") parts.push(current)
  return parts
}

export function chunkDocPage(args: {
  body: string
  frontmatter: DocFrontmatter
}): DocChunk[] {
  const sections: { heading: string | null; lines: string[] }[] = [
    { heading: null, lines: [] },
  ]
  // Split on h2 AND h3. An h3 is its own answer to its own question: the
  // troubleshooting pages put four distinct error messages under one h2, and
  // folding them into a single chunk both diluted each one against the other
  // three and gave them all the h2's anchor, so a deep link landed on the
  // section rather than on the message the reader asked about.
  for (const line of args.body.split("\n")) {
    const heading = /^#{2,3}\s+(.+)$/.exec(line)
    if (heading?.[1] !== undefined) {
      sections.push({ heading: heading[1], lines: [] })
    } else sections.at(-1)?.lines.push(line)
  }
  const chunks: DocChunk[] = []
  for (const section of sections) {
    if (isLinkOnlyListSection(section.lines)) continue
    const plain = stripMarkdown(section.lines.join("\n"))
    if (plain === "") continue
    // The heading is part of the text so a search for its words hits.
    const withHeading =
      section.heading === null ? plain : `${section.heading}\n${plain}`
    for (const text of split(withHeading)) {
      chunks.push({
        pageTitle: args.frontmatter.title,
        heading: section.heading,
        anchor:
          section.heading === null ? null : headingAnchor(section.heading),
        text,
      })
    }
  }
  return chunks
}
