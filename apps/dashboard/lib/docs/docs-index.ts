import { headingTexts } from "./anchors"
import { getDoc } from "./docs"
import { allDocSlugs } from "./docs-nav"

// The command palette's view of the guide corpus: what a client needs to
// match a query against and build a link from, and nothing else. The bodies
// stay on the server (they are the reading surface, and semantic search over
// them is the assistant's job, not the palette's).
//
// Headings carry their TEXT only. The anchor is derived on the client with
// headingAnchor, the same function the MDX renderer uses to write the id, so
// the payload never carries a second copy of a derivable string and the link
// cannot drift from the heading it points at.
//
// This module reads the filesystem (through getDoc). A client module may
// import the types from it, but only with `import type`, which erases.
export interface DocsIndexEntry {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly headings: readonly string[]
}

export type DocsIndex = readonly DocsIndexEntry[]

// The corpus is static for the life of the deployment, so a locale's index is
// built once per server process and reused. Without this, every palette open
// would re-read and re-parse 56 files. The promise (not the value) is cached
// so concurrent first requests share one build.
const cachedIndexes = new Map<string, Promise<DocsIndex>>()

async function buildDocsIndex(locale: string): Promise<DocsIndex> {
  const docs = await Promise.all(
    allDocSlugs().map((slug) => getDoc(locale, slug))
  )
  return docs
    .filter((doc) => doc !== null)
    .map((doc) => ({
      slug: doc.slug,
      title: doc.frontmatter.title,
      description: doc.frontmatter.description,
      headings: headingTexts(doc.body),
    }))
}

export function getDocsIndex(locale: string): Promise<DocsIndex> {
  const cached = cachedIndexes.get(locale)
  if (cached !== undefined) return cached
  // A failed build is dropped rather than cached: caching the rejection would
  // make one unreadable file permanent for the life of the process.
  const building = buildDocsIndex(locale).catch((error: unknown) => {
    cachedIndexes.delete(locale)
    throw error
  })
  cachedIndexes.set(locale, building)
  return building
}
