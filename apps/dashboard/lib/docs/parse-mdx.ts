import { load } from "js-yaml"

// gray-matter is incompatible with the repo's js-yaml 4 security pin, so
// the frontmatter fence is split here and js-yaml parses the YAML block.
// Validation stays in docFrontmatterSchema at the call sites.
export function parseMdx(raw: string): { data: unknown; content: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  if (match === null) return { data: {}, content: raw }
  return {
    data: load(match[1] ?? "") ?? {},
    content: raw.slice(match[0].length),
  }
}
