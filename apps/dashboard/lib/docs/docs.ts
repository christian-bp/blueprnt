import { readFile } from "node:fs/promises"
import path from "node:path"
import { cache } from "react"
import { allDocSlugs } from "./docs-nav"
import { docFrontmatterSchema, type DocFrontmatter } from "./frontmatter"
import { parseMdx } from "./parse-mdx"

export interface Doc {
  slug: string
  frontmatter: DocFrontmatter
  body: string
}

const CONTENT_ROOT = path.join(process.cwd(), "content", "docs")

// Slugs arrive from the URL; only nav-listed slugs ever reach the
// filesystem, which is both the 404 rule and the path-traversal guard.
export const getDoc = cache(
  async (locale: string, slug: string): Promise<Doc | null> => {
    if (!allDocSlugs().includes(slug)) return null
    const raw = await readFile(
      path.join(CONTENT_ROOT, locale, `${slug}.mdx`),
      "utf8"
    )
    const { data, content } = parseMdx(raw)
    return {
      slug,
      frontmatter: docFrontmatterSchema.parse(data),
      body: content,
    }
  }
)

export function getAdjacentDocs(slug: string): {
  previous: string | null
  next: string | null
} {
  const slugs = allDocSlugs()
  const index = slugs.indexOf(slug)
  if (index === -1) return { previous: null, next: null }
  return {
    previous: slugs[index - 1] ?? null,
    next: slugs[index + 1] ?? null,
  }
}
