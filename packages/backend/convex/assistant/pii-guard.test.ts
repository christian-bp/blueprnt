import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

// Source-confinement guard (ADR-0018/ADR-0019): person-table access stays
// inside insights.ts. Walks both this directory and docs/ (search_docs's
// query implementation, reachable from an assistant tool call, lives there
// rather than under assistant/) recursively AT RUNTIME (never a hardcoded
// file list, so a later subdirectory such as assistant/tools/ is covered
// automatically) and matches whitespace-tolerant patterns, because Biome
// wraps a chained call across lines (ctx.db\n  .query("people")), where a
// plain contiguous substring search would silently never match a single
// line of real, formatted code. Same file-driven guard style as the
// audit-label tests, applied to source text instead of i18n keys.
const ASSISTANT_DIR = dirname(fileURLToPath(import.meta.url))
const CONVEX_DIR = dirname(ASSISTANT_DIR)
const DOCS_DIR = join(CONVEX_DIR, "docs")
const GUARDED_DIRS = [ASSISTANT_DIR, DOCS_DIR]
const ALLOWED_FILE = "assistant/insights.ts"

const PERSON_TABLE_PATTERNS: Record<string, RegExp> = {
  people: /\.query\(\s*"people"\s*\)/,
  payRecords: /\.query\(\s*"payRecords"\s*\)/,
  personAssignments: /\.query\(\s*"personAssignments"\s*\)/,
}

// The realistic leak path once chat.ts/tools.ts/erase.ts land: a file that
// cannot call db.query on a person table directly could still reach into one
// through an internal function reference instead. Both namespaces expose
// person-row functions (people/* for people/payRecords/personAssignments,
// payMapping/* for the frozen but still pseudonymizable snapshot rows).
const INTERNAL_PERSON_NAMESPACE_PATTERNS = [
  /internal\.people\./,
  /internal\.payMapping\./,
]

interface SourceFile {
  relativePath: string
  content: string
}

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(full))
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(full)
    }
  }
  return files
}

function sourceFilesIn(dir: string): SourceFile[] {
  return walk(dir)
    .filter((path) => !path.endsWith(".test.ts"))
    .map((path) => ({
      relativePath: relative(CONVEX_DIR, path),
      content: readFileSync(path, "utf8"),
    }))
}

function guardedSourceFiles(): SourceFile[] {
  return GUARDED_DIRS.flatMap(sourceFilesIn)
}

describe("assistant person-table confinement", () => {
  it("scans a non-empty, real file list", () => {
    // Defensive against a path-resolution bug that would make the guards
    // below vacuously pass by finding nothing to scan.
    const files = guardedSourceFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(files.map((file) => file.relativePath)).toContain(ALLOWED_FILE)
  })

  it("insights.ts itself matches the people and payRecords patterns (positive control)", () => {
    // Proves the regexes actually match real, Biome-formatted code (the
    // exact-substring version of this test could never match and passed
    // vacuously); a pattern regression here fails loudly instead of the
    // negative check below silently losing its teeth.
    const insights = guardedSourceFiles().find(
      (file) => file.relativePath === ALLOWED_FILE
    )
    expect(insights).toBeDefined()
    expect(PERSON_TABLE_PATTERNS.people?.test(insights?.content ?? "")).toBe(
      true
    )
    expect(
      PERSON_TABLE_PATTERNS.payRecords?.test(insights?.content ?? "")
    ).toBe(true)
  })

  it('db.query("people" | "payRecords" | "personAssignments") appears only in insights.ts', () => {
    const offenders: string[] = []
    for (const file of guardedSourceFiles()) {
      if (file.relativePath === ALLOWED_FILE) continue
      for (const [table, pattern] of Object.entries(PERSON_TABLE_PATTERNS)) {
        if (pattern.test(file.content)) {
          offenders.push(`${file.relativePath}: db.query("${table}")`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("no non-insights file reaches a person table through an internal function reference", () => {
    const offenders: string[] = []
    for (const file of guardedSourceFiles()) {
      if (file.relativePath === ALLOWED_FILE) continue
      for (const pattern of INTERNAL_PERSON_NAMESPACE_PATTERNS) {
        if (pattern.test(file.content)) {
          offenders.push(`${file.relativePath}: ${pattern}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
