import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  assertPromptDataSafe,
  buildPrompt,
  FORBIDDEN_OUTCOME_KEYS,
  PromptContaminationError,
  promptJson,
} from "./promptGuard"

describe("assertPromptDataSafe: never feed outcomes", () => {
  it("passes the shapes a method prompt legitimately carries", () => {
    expect(() =>
      assertPromptDataSafe(
        {
          criteria: [
            {
              criterionId: "c1",
              name: "Knowledge depth and specialist level",
              weightPoints: 4,
              motivation: "Specialist depth decides the work here.",
            },
          ],
          families: [
            { name: "Engineering", roleCount: 12, sampleTitles: ["Developer"] },
          ],
          workingConditions: { status: "active", motivation: "On-call." },
        },
        "test"
      )
    ).not.toThrow()
  })

  // The poisoned context: a results row spread into the prompt data. This is
  // the exact mistake the guard exists for, and it must be impossible.
  it("refuses a results row spread into prompt data", () => {
    const poisoned = {
      criteria: [{ criterionId: "c1", name: "Scope", weightPoints: 4 }],
      roles: [
        {
          roleId: "r1",
          title: "Developer",
          score: 74,
          level: 3,
          complete: true,
        },
      ],
    }
    expect(() => assertPromptDataSafe(poisoned, "test")).toThrow(
      PromptContaminationError
    )
    expect(() => assertPromptDataSafe(poisoned, "test")).toThrow(/score/)
  })

  it.each(FORBIDDEN_OUTCOME_KEYS)("refuses the outcome key %s", (key) => {
    expect(() => assertPromptDataSafe({ [key]: 1 }, "test")).toThrow(
      PromptContaminationError
    )
  })

  it("refuses an outcome key nested deep inside arrays", () => {
    expect(() =>
      assertPromptDataSafe(
        { families: [{ name: "Eng", roles: [{ title: "Dev", zone: "A" }] }] },
        "test"
      )
    ).toThrow(/zone/)
  })

  it("refuses person data as firmly as outcomes (Role != Person)", () => {
    expect(() =>
      assertPromptDataSafe(
        { people: [{ displayName: "Anna", salary: 52000 }] },
        "test"
      )
    ).toThrow(PromptContaminationError)
    expect(() =>
      assertPromptDataSafe({ role: { title: "Dev", gender: "F" } }, "test")
    ).toThrow(/gender/)
  })

  // Structural, never prose. The criteria library ships a criterion NAMED
  // "Knowledge depth and specialist level" and the prompt must quote criterion
  // names verbatim, so a word scan would refuse the app's own content.
  it("never refuses a legitimate name that merely contains a forbidden word", () => {
    expect(() =>
      assertPromptDataSafe(
        { name: "Knowledge depth and specialist level", note: "zone of work" },
        "test"
      )
    ).not.toThrow()
  })

  // Exact key matching, so the guard stays predictable instead of becoming a
  // fuzzy filter that refuses arbitrary future fields.
  it("matches keys exactly, not as substrings", () => {
    expect(() =>
      assertPromptDataSafe({ weightPoints: 3, scoreCard: "x" }, "test")
    ).not.toThrow()
  })

  it("matches keys case-insensitively", () => {
    expect(() => assertPromptDataSafe({ Score: 74 }, "test")).toThrow(
      PromptContaminationError
    )
  })

  it("survives a cyclic structure instead of hanging", () => {
    const node: Record<string, unknown> = { title: "Dev" }
    node.self = node
    expect(() => assertPromptDataSafe(node, "test")).not.toThrow()
  })
})

describe("promptJson and buildPrompt", () => {
  it("guards and serializes in one call", () => {
    expect(promptJson({ name: "Eng", roleCount: 3 }, "test")).toBe(
      '{"name":"Eng","roleCount":3}'
    )
    expect(() => promptJson({ level: 3 }, "test")).toThrow(
      PromptContaminationError
    )
  })

  it("joins the lines it is given", () => {
    expect(buildPrompt(["one", "two"], "test")).toBe("one\ntwo")
  })

  // The backstop: a line that serialized its own JSON without promptJson.
  it("refuses an assembled prompt carrying a serialized outcome key", () => {
    expect(() =>
      buildPrompt(['Roles: [{"title":"Dev","level":3}]'], "test")
    ).toThrow(PromptContaminationError)
  })

  it("leaves ordinary prose alone, including the word level", () => {
    expect(() =>
      buildPrompt(["5 = heaviest relative weight, specialist level"], "test")
    ).not.toThrow()
  })

  // The backstop governs OUR assembly, never the user's words. Every prompt
  // that carries user text wraps it in a data tag, and scanning inside one
  // turned the guard into a content filter: an HR specialist pasting a role
  // export that happens to be JSON failed the whole import with no explanation
  // anywhere, and a chat message containing `"score": 74` silently lost its
  // thread title.
  it.each([
    [
      "a pasted role list that happens to be JSON",
      '<pasted_roles>[{"title":"Developer","level":3}]</pasted_roles>',
    ],
    [
      "a role description quoting a score",
      '<role_description>Owns the model where "score": 74 came from.</role_description>',
    ],
    [
      "a chat message quoting a result",
      '<user_message>Why is "level": 3 on this role?</user_message>',
    ],
    [
      "a criterion description a user wrote",
      '<criterion_description>Covers what "value": 5 means here.</criterion_description>',
    ],
    ["a tag carrying attributes", '<role index="0">Level 3 Analyst</role>'],
  ])("accepts %s", (_name, line) => {
    expect(() =>
      buildPrompt(["Instructions we wrote.", line], "test")
    ).not.toThrow()
  })

  // And the backstop still does its job on the line beside it: stripping the
  // user's block must not disarm the scan for our own.
  it("still refuses our own serialized outcome beside a user's block", () => {
    expect(() =>
      buildPrompt(
        [
          '<pasted_roles>[{"title":"Developer","level":3}]</pasted_roles>',
          'Roles: [{"title":"Developer","score":74}]',
        ],
        "test"
      )
    ).toThrow(PromptContaminationError)
  })

  it("refuses an unclosed data tag rather than treating the rest as data", () => {
    expect(() =>
      buildPrompt(
        ['<pasted_roles>[{"level":3}]', 'Roles: [{"score":74}]'],
        "test"
      )
    ).toThrow(PromptContaminationError)
  })
})

// The raw 0-5 an assessor gave IS an assessment value, and a ratings row is the
// shape most likely to be spread into a prompt by accident.
describe("the ratings table's own outcome field", () => {
  it("refuses a ratings row", () => {
    expect(() =>
      assertPromptDataSafe(
        { ratings: [{ criterionId: "c1", value: 4, motivation: "Broad." }] },
        "test"
      )
    ).toThrow(PromptContaminationError)
    // Refused on `value` even without the giveaway `ratings` wrapper.
    expect(() =>
      assertPromptDataSafe([{ criterionId: "c1", value: 4 }], "test")
    ).toThrow(/value/)
  })

  it("refuses a role result's profileFailures", () => {
    expect(() =>
      assertPromptDataSafe({ profileFailures: ["scope-impact"] }, "test")
    ).toThrow(PromptContaminationError)
  })

  // The fields our prompts actually carry name themselves; none is a bare
  // `value`, which is why the key can be forbidden outright.
  it("leaves every shape a prompt legitimately sends alone", () => {
    expect(() =>
      assertPromptDataSafe(
        {
          criteria: [{ criterionId: "c1", name: "Scope", weightPoints: 4 }],
          families: [{ name: "Eng", roleCount: 3, sampleTitles: ["Dev"] }],
          workingConditions: { status: "active", motivation: "On-call." },
          tracks: [{ key: "IC", name: "Individual contributor" }],
          anchors: ["Follows a method.", "Defines the field."],
        },
        "test"
      )
    ).not.toThrow()
  })
})

// Source-confinement guard, in the same style as assistant/pii-guard.test.ts:
// the seam only holds if EVERY prompt path goes through it. A new prompt that
// joins its own lines would silently opt out of both invariants, so the
// assembly shape itself is pinned rather than trusted to memory.
const AI_DIR = dirname(fileURLToPath(import.meta.url))
const CONVEX_DIR = dirname(AI_DIR)
const GUARDED_DIRS = [AI_DIR, join(CONVEX_DIR, "assistant")]

function sourceFiles(dir: string): { path: string; content: string }[] {
  const out: { path: string; content: string }[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full))
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      out.push({
        path: relative(CONVEX_DIR, full),
        content: readFileSync(full, "utf8"),
      })
    }
  }
  return out
}

describe("every prompt path goes through the guard", () => {
  it("assembles every prompt with buildPrompt", () => {
    const offenders: string[] = []
    for (const dir of GUARDED_DIRS) {
      for (const file of sourceFiles(dir)) {
        for (const line of file.content.split("\n")) {
          const trimmed = line.trim()
          if (!trimmed.startsWith("prompt:")) continue
          if (trimmed.includes("buildPrompt(")) continue
          offenders.push(`${file.path}: ${trimmed}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  // Self-check: the scan must actually find the prompt sites, or an empty
  // offender list means nothing.
  it("finds the prompt sites it is guarding", () => {
    let found = 0
    for (const dir of GUARDED_DIRS) {
      for (const file of sourceFiles(dir)) {
        for (const line of file.content.split("\n")) {
          if (line.trim().startsWith("prompt:")) found += 1
        }
      }
    }
    expect(found).toBeGreaterThanOrEqual(6)
  })
})
