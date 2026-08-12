/// <reference types="vite/client" />
import { describe, expect, it } from "vitest"

// Source-confinement guard (ADR-0018): person-table access stays inside
// insights.ts. Reads the .ts files that exist in this directory AT RUNTIME
// via Vite's import.meta.glob raw-text import (never a hardcoded file list,
// and no Node builtins, so this stays a plain vitest test module rather than
// a Convex function file), so a later task adding chat.ts / generate.ts /
// tools.ts / erase.ts is covered automatically: a future tool that quietly
// reaches into a person table from outside insights.ts fails this test
// instead of leaking PII past the aggregate-only return validators. Same
// file-driven guard style as the audit-label tests, applied to source text
// instead of i18n keys.
const PERSON_TABLES = ["people", "payRecords", "personAssignments"] as const
const ALLOWED_FILE = "insights.ts"

const rawModules = import.meta.glob<string>("./*.ts", {
  eager: true,
  query: "?raw",
  import: "default",
})

function assistantSourceFiles(): { name: string; content: string }[] {
  return Object.entries(rawModules)
    .map(([path, content]) => ({ name: path.replace("./", ""), content }))
    .filter(({ name }) => !name.endsWith(".test.ts"))
}

describe("assistant person-table confinement", () => {
  it("scans a non-empty, real file list", () => {
    // Defensive against a glob-pattern bug that would make the guard below
    // vacuously pass by finding nothing to scan.
    const files = assistantSourceFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(files.map((file) => file.name)).toContain(ALLOWED_FILE)
  })

  it('db.query("people" | "payRecords" | "personAssignments") appears only in insights.ts', () => {
    const offenders: string[] = []
    for (const file of assistantSourceFiles()) {
      if (file.name === ALLOWED_FILE) continue
      for (const table of PERSON_TABLES) {
        if (file.content.includes(`db.query("${table}")`)) {
          offenders.push(`${file.name}: db.query("${table}")`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
