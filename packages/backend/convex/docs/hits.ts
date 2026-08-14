// Turning the RAG component's search results into the documentation hits the
// assistant links. Kept apart from rag.ts (which is "use node" and pulls in
// the component and the AI SDK) so the mapping, the part that decides what a
// user actually sees, is unit-testable on its own. convex/values is the only
// import allowed to cross into here: it is a plain value library with none
// of that weight.

import { type Infer, v } from "convex/values"

// The hit's shape, declared once. searchDocs returns this same validator, so
// the wire contract and the mapping's type cannot drift apart.
export const docsHitValidator = v.object({
  pageTitle: v.string(),
  heading: v.union(v.string(), v.null()),
  path: v.string(),
  text: v.string(),
})

export type DocsHit = Infer<typeof docsHitValidator>

export interface SearchResultLike {
  content: { text: string; metadata?: Record<string, unknown> | undefined }[]
  // Where the returned window starts relative to the chunk that matched.
  // Equal to `order` while chunkContext is off, so the matched chunk is
  // content[0]; with context enabled the window opens on EARLIER chunks and
  // the matched one sits at `order - startOrder`.
  order?: number
  startOrder?: number
}

const stringOr = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback

const stringOrNull = (value: unknown): string | null =>
  typeof value === "string" ? value : null

export function hitsFrom(
  results: SearchResultLike[],
  isFallback: boolean
): DocsHit[] {
  const hits: DocsHit[] = []
  for (const result of results) {
    // The anchor must come from the chunk that actually matched, not from
    // whichever chunk the window happens to open on: a preceding chunk
    // belongs to an earlier section and would deep-link the reader to the
    // wrong heading, silently and with no error anywhere.
    const matched = (result.order ?? 0) - (result.startOrder ?? 0)
    const meta = (result.content[matched] ?? result.content[0])?.metadata
    const slug = stringOrNull(meta?.slug)
    // A result whose chunk carries no slug cannot be linked, and an
    // unlinkable excerpt is worse than no excerpt: the model would quote it
    // and point nowhere.
    if (slug === null) continue
    const anchor = stringOrNull(meta?.anchor)
    hits.push({
      pageTitle: stringOr(meta?.pageTitle, ""),
      heading: stringOrNull(meta?.heading),
      // A fallback hit's anchor was derived from the English heading text,
      // which does not exist on the caller's locale page (headings, and so
      // their anchors, are translated), so linking to it would land at the
      // top of the page instead of the anchor. Only a same-locale hit gets
      // an anchored path.
      path:
        anchor === null || isFallback
          ? `/docs/${slug}`
          : `/docs/${slug}#${anchor}`,
      text: result.content.map((part) => part.text).join("\n"),
    })
  }
  return hits
}
