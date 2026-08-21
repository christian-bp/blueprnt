import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

// THE RULE: the dashboard may share the backend's CONTENT and CONSTANTS (the
// criteria library's prose, a validator's key list, an audit domain), and only
// ever from modules that register no Convex functions.
//
// Importing a VALUE out of a module that defines queries or mutations pulls
// that module, and everything it imports, into the browser bundle. Convex says
// so at runtime ("Convex functions should not be imported in the browser") and
// later versions throw. It shipped once: the model-approval reopen causes were
// exported from the mutation module that consumes them, and one runtime import
// in lib/audit-constants.ts dragged four function modules into the client.
//
// A TYPE-only import is free (it is erased), which is why the rule is about
// runtime imports and why this walk skips `import type` and all-type braces.
//
// Test files are out of scope: they never reach a browser, and two of the
// audit drift guards deliberately import their field lists from the modules
// that own them (evaluationModel/method.ts, criteria.ts), which is the right
// coupling for a guard and the wrong one for a bundle.
const ROOT = process.cwd()
const BACKEND = join(ROOT, "../../packages/backend/convex")
const BACKEND_SPECIFIER = "@workspace/backend/convex/"

// An export whose initializer CALLS something named like a Convex registrar:
// query/mutation/action, their internal* forms, and this repo's own wrappers
// (orgQuery, adminMutation, customMutation, httpAction...). Anchored at
// `export const X =` so a `ctx.db.query(` inside a handler is never mistaken
// for a registration.
const EXPORTED_CALL = /^export\s+const\s+\w+\s*=\s*([A-Za-z_$][\w$]*)\s*\(/gm
const REGISTRAR = /(query|mutation|action)$/i

function registrations(file: string): string[] {
  const found = new Set<string>()
  for (const match of readFileSync(file, "utf8").matchAll(EXPORTED_CALL)) {
    const callee = match[1]
    if (callee !== undefined && REGISTRAR.test(callee)) found.add(callee)
  }
  return [...found]
}

// The runtime import specifiers of one module: `import type` and braces whose
// every member is `type X` are erased at build time and carry nothing into a
// bundle.
const IMPORTS = /import\s+(type\s+)?([\s\S]*?)from\s+"([^"]+)"/g

function runtimeImports(file: string): string[] {
  const specifiers: string[] = []
  for (const match of readFileSync(file, "utf8").matchAll(IMPORTS)) {
    if (match[1] !== undefined) continue
    const clause = match[2] ?? ""
    const braces = /\{([\s\S]*)\}/.exec(clause)
    if (braces !== null) {
      const members = (braces[1] ?? "")
        .split(",")
        .map((member) => member.trim())
        .filter((member) => member.length > 0)
      const outside = clause
        .replace(/\{[\s\S]*\}/, "")
        .replace(/,/g, "")
        .trim()
      const carriesValue = members.some((member) => !member.startsWith("type "))
      if (!carriesValue && outside === "") continue
    }
    const specifier = match[3]
    if (specifier !== undefined) specifiers.push(specifier)
  }
  return specifiers
}

function resolveModule(base: string, specifier: string): string | null {
  const path = specifier.startsWith(".")
    ? resolve(dirname(base), specifier)
    : join(BACKEND, specifier.slice(BACKEND_SPECIFIER.length))
  for (const suffix of [".ts", ".tsx", "/index.ts"]) {
    if (existsSync(path + suffix)) return path + suffix
  }
  return null
}

// Every backend module a given entry reaches at runtime, itself included.
function runtimeClosure(entry: string): string[] {
  const seen = new Set([entry])
  const queue = [entry]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) continue
    for (const specifier of runtimeImports(current)) {
      if (!specifier.startsWith(".")) continue
      const next = resolveModule(current, specifier)
      if (next !== null && !seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return [...seen]
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") {
      continue
    }
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      sourceFiles(path, out)
    } else if (/\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)) {
      out.push(path)
    }
  }
  return out
}

describe("the dashboard's backend imports", () => {
  // Collected once: every runtime specifier into the backend, from the app's
  // own source.
  const entries = new Map<string, string[]>()
  for (const file of sourceFiles(ROOT)) {
    for (const specifier of runtimeImports(file)) {
      if (!specifier.startsWith(BACKEND_SPECIFIER)) continue
      // _generated/api is the sanctioned client surface: a proxy object with
      // no function bodies behind it, which is how every useQuery call names
      // its function.
      if (specifier.includes("_generated")) continue
      const resolved = resolveModule(file, specifier)
      expect(resolved, `unresolved backend import ${specifier}`).not.toBeNull()
      if (resolved === null) continue
      entries.set(resolved, [...(entries.get(resolved) ?? []), file])
    }
  }

  it("reaches no Convex function module, directly or transitively", () => {
    const offenders: string[] = []
    for (const [entry, importers] of entries) {
      for (const module of runtimeClosure(entry)) {
        const found = registrations(module)
        if (found.length === 0) continue
        offenders.push(
          `${module.replace(`${BACKEND}/`, "")} (${found.join(", ")})` +
            ` <- ${entry.replace(`${BACKEND}/`, "")}` +
            ` <- ${importers.map((f) => f.replace(`${ROOT}/`, "")).join(", ")}`
        )
      }
    }
    expect(offenders).toEqual([])
  })

  // The walk is only worth having if it can actually see a registration: point
  // it at a module that defines mutations and it must say so. Without this the
  // test above passes just as happily with a broken detector.
  it("detects a function module when it meets one", () => {
    const approval = join(BACKEND, "evaluationModel/approval.ts")
    expect(existsSync(approval)).toBe(true)
    expect(registrations(approval).length).toBeGreaterThan(0)
    // And through an import chain, not only at the entry itself: this module
    // reaches the mutation module above.
    const chain = runtimeClosure(join(BACKEND, "evaluationModel/criteria.ts"))
    expect(
      chain.filter((module) => registrations(module).length > 0).length
    ).toBeGreaterThan(1)
  })

  // The move that prompted the rule, pinned by name: the reopen causes are
  // shared from a module with no functions in it.
  it("takes the approval reopen causes from a function-free module", () => {
    const causes = join(BACKEND, "evaluationModel/approvalCauses.ts")
    expect(existsSync(causes)).toBe(true)
    for (const module of runtimeClosure(causes)) {
      expect(registrations(module)).toEqual([])
    }
  })
})
