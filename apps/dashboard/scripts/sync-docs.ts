import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { routing } from "@workspace/i18n/routing"
import { CHUNKER_VERSION, chunkDocPage } from "../lib/docs/chunk"
import { docFrontmatterSchema } from "../lib/docs/frontmatter"
import { parseMdx } from "../lib/docs/parse-mdx"

const CONTENT_ROOT = new URL("../content/docs/", import.meta.url).pathname
const BACKEND_DIR = new URL("../../../packages/backend", import.meta.url)
  .pathname

// node:child_process, not Bun.spawn: the ambient Bun global needs
// @types/bun, and referencing that package's types repo-wide redefines
// the global fetch type and breaks an unrelated test's fetch mock. Bun
// runs node:child_process natively, so this keeps the same behavior
// without touching the program's global type environment.
async function convexRun(fn: string, args: unknown): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const proc = spawn("bunx", ["convex", "run", fn, JSON.stringify(args)], {
      cwd: BACKEND_DIR,
    })
    let stdout = ""
    let stderr = ""
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    proc.on("error", reject)
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`${fn} failed: ${stderr}`))
      else resolve(stdout)
    })
  })
}

// `convex run` prints the function's return value last, formatted with
// JSON.stringify(value, null, 2) when stdout is not a TTY, so an object
// spans several lines while a scalar is one. Parse the shortest suffix of
// stdout that is a complete JSON value rather than sniffing stdout for a
// substring: the component logs to the same stream, so a substring test
// would report whatever a log line happened to contain.
function parseResult<T>(stdout: string): T {
  const lines = stdout.trimEnd().split("\n")
  for (let start = lines.length - 1; start >= 0; start -= 1) {
    try {
      return JSON.parse(lines.slice(start).join("\n")) as T
    } catch {
      // Not a complete value yet: widen to one more line.
    }
  }
  throw new Error(`no return value in output: ${stdout}`)
}

// The deploy guard's standing rule is to classify and announce the target
// deployment before any command that writes to one. `convex run` resolves it
// from CONVEX_DEPLOY_KEY first, then CONVEX_DEPLOYMENT in the environment,
// then the backend's .env.local, so the announcement resolves it in the same
// order instead of assuming the file.
async function resolveTarget(): Promise<string> {
  const key = process.env.CONVEX_DEPLOY_KEY
  if (key !== undefined && key !== "") {
    return "deploy key (CONVEX_DEPLOY_KEY is set and decides the target)"
  }
  let value = process.env.CONVEX_DEPLOYMENT
  if (value === undefined || value === "") {
    // Absent on a fresh clone and in any CI job that configures Convex
    // through the environment instead. The announcement must never be the
    // thing that fails the run: without this the script would die on a raw
    // ENOENT before printing a target, a failure list, or anything at all,
    // where the CLI itself reports "not configured" perfectly well.
    try {
      const file = await readFile(path.join(BACKEND_DIR, ".env.local"), "utf8")
      value = /^CONVEX_DEPLOYMENT=(.*)$/m.exec(file)?.[1]
    } catch {
      return "unknown (no CONVEX_DEPLOYMENT and no backend .env.local)"
    }
  }
  // The CLI writes the deployment line with a trailing `# team: ...` comment.
  const raw = (value ?? "").split("#")[0]?.trim() ?? ""
  if (raw === "") return "unknown"
  const separator = raw.indexOf(":")
  if (separator === -1) return `unknown (${raw})`
  return `${raw.slice(0, separator)} (${raw.slice(separator + 1)})`
}

// routing.locales, not a raw readdir: a stray or misnamed directory under
// content/docs (a typo, an editor backup folder, a wrong case) must never
// be indexed under an unrecognized locale namespace. Intersected with what actually exists on disk so a locale
// listed in routing but not yet authored is skipped rather than erroring.
const onDisk = new Set(
  (await readdir(CONTENT_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
)
// An optional locale argument (`bun run docs:sync sv`) narrows the run to one
// locale, so content work on a single language does not pay to re-check the
// whole corpus. With no argument every configured locale is synced.
const only = process.argv[2]
const locales = routing.locales.filter(
  (locale) =>
    onDisk.has(locale) && (only === undefined || only === "" || only === locale)
)
if (locales.length === 0) {
  throw new Error(`no locales to sync (argument: ${only ?? "none"})`)
}

console.log(`target: ${await resolveTarget()}`)

// A page that fails (a provider rate limit that outlived the transport's
// retry budget, a malformed frontmatter) must not take the run down with it:
// the remaining pages of the locale, its sweep, and every later locale still
// have work to do. Failures are collected and reported at the end, and the
// exit code stays honest about them.
const failures: { where: string; error: string }[] = []
const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

for (const locale of locales) {
  const files = (await readdir(path.join(CONTENT_ROOT, locale))).filter((f) =>
    f.endsWith(".mdx")
  )
  const slugs: string[] = []
  for (const file of files) {
    const slug = file.replace(/\.mdx$/, "")
    // Pushed before the call, not after it: a page that failed to index is
    // still on disk, so it must stay in keepSlugs or the sweep below would
    // read it as retired and delete the copy that is still serving searches.
    slugs.push(slug)
    try {
      const raw = await readFile(path.join(CONTENT_ROOT, locale, file), "utf8")
      const { data, content } = parseMdx(raw)
      const frontmatter = docFrontmatterSchema.parse(data)
      const wrote = await convexRun("docs/rag:indexPage", {
        locale,
        slug,
        pageTitle: frontmatter.title,
        // The chunker version is part of the hash so a chunker change forces
        // a resync; the component skips the embedding call when it matches.
        pageHash: createHash("sha256")
          .update(CHUNKER_VERSION)
          .update(raw)
          .digest("hex"),
        chunks: chunkDocPage({ body: content, frontmatter }),
      })
      const indexed = parseResult<boolean>(wrote)
      console.log(`${locale}/${slug}: ${indexed ? "indexed" : "unchanged"}`)
    } catch (error) {
      failures.push({ where: `${locale}/${slug}`, error: describe(error) })
      console.error(`${locale}/${slug}: FAILED`)
    }
  }
  try {
    const swept = await convexRun("docs/rag:sweepLocale", {
      locale,
      keepSlugs: slugs,
    })
    const { retired, reclaimed } = parseResult<{
      retired: number
      reclaimed: number
    }>(swept)
    console.log(
      `${locale}: retired ${retired} page(s), reclaimed ${reclaimed} superseded version(s)`
    )
  } catch (error) {
    failures.push({ where: `${locale} sweep`, error: describe(error) })
    console.error(`${locale} sweep: FAILED`)
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} step(s) failed:`)
  for (const failure of failures) {
    console.error(`  ${failure.where}: ${failure.error}`)
  }
  process.exit(1)
}
