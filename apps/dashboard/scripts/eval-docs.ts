import { spawn } from "node:child_process"
import {
  DOCS_EVAL_OFFTOPIC,
  DOCS_EVAL_PROBES,
  type DocsEvalProbe,
} from "../lib/docs/eval-probes"

// Measures documentation retrieval against the checked-in probe set and
// prints a table per configuration. Opt-in (`bun run docs:eval`), never part
// of `turbo run test`: it costs one embedding call per query and needs a live
// deployment with a synced index.
//
// A configuration is measured once per query at the widest limit, and the
// candidate score thresholds are then simulated offline from the returned
// scores. That keeps a full sweep to one call per query instead of one per
// (query, threshold) pair. Hybrid scores are a fusion RANK, not a cosine
// similarity, so hybrid is measured on its own and never thresholded on the
// vector scale.

const BACKEND_DIR = new URL("../../../packages/backend", import.meta.url)
  .pathname
const TOP_K = 5
const WIDE_LIMIT = 10
const THRESHOLDS = [0, 0.5, 0.6, 0.65, 0.7, 0.75, 0.8]

interface Hit {
  path: string
  pageTitle: string
  score: number
}

async function convexRun(fn: string, args: unknown): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const proc = spawn("bunx", ["convex", "run", fn, JSON.stringify(args)], {
      cwd: BACKEND_DIR,
    })
    let stdout = ""
    let stderr = ""
    proc.stdout.on("data", (c: Buffer) => {
      stdout += c.toString()
    })
    proc.stderr.on("data", (c: Buffer) => {
      stderr += c.toString()
    })
    proc.on("error", reject)
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`${fn} failed: ${stderr}`))
      else resolve(stdout)
    })
  })
}

async function search(
  locale: string,
  query: string,
  searchType: "vector" | "hybrid"
): Promise<Hit[]> {
  const out = await convexRun("docs/rag:evalSearch", {
    locale,
    query,
    limit: WIDE_LIMIT,
    searchType,
  })
  // `convex run` pretty-prints the return value across several lines and may
  // precede it with the component's own log output, so the payload starts at
  // the first bracket rather than on the last line.
  const start = out.indexOf("[")
  return start === -1 ? [] : (JSON.parse(out.slice(start)) as Hit[])
}

const slugOf = (path: string) => path.replace("/docs/", "").split("#")[0] ?? ""

// Recall at TOP_K after dropping everything below `threshold`, simulated from
// the wide result set.
function hits(probe: DocsEvalProbe, results: Hit[], threshold: number) {
  const kept = results.filter((r) => r.score >= threshold).slice(0, TOP_K)
  return kept.some((r) => slugOf(r.path) === probe.expected)
}

async function main() {
  const locales = Object.keys(DOCS_EVAL_PROBES)
  for (const searchType of ["vector", "hybrid"] as const) {
    console.log(`\n=== searchType: ${searchType} ===`)
    for (const locale of locales) {
      const probes = DOCS_EVAL_PROBES[locale] ?? []
      const offtopic = DOCS_EVAL_OFFTOPIC[locale] ?? []
      const probeResults: Hit[][] = []
      for (const probe of probes) {
        probeResults.push(await search(locale, probe.query, searchType))
      }
      const offResults: Hit[][] = []
      for (const query of offtopic) {
        offResults.push(await search(locale, query, searchType))
      }
      // Hybrid's score is a fusion rank on its own scale, so only the
      // unthresholded column is meaningful for it.
      const sweep = searchType === "hybrid" ? [0] : THRESHOLDS
      for (const threshold of sweep) {
        const recall = probes.filter((p, i) =>
          hits(p, probeResults[i] ?? [], threshold)
        ).length
        const silent = offResults.filter(
          (r) => r.filter((h) => h.score >= threshold).length === 0
        ).length
        console.log(
          `${locale}  threshold=${threshold.toFixed(2)}  recall@${TOP_K}=${recall}/${probes.length}  offtopic-silent=${silent}/${offtopic.length}`
        )
      }
      for (const [i, probe] of probes.entries()) {
        if (!hits(probe, probeResults[i] ?? [], 0)) {
          const got = (probeResults[i] ?? [])
            .slice(0, 3)
            .map((h) => `${slugOf(h.path)}(${h.score.toFixed(2)})`)
            .join(" ")
          console.log(`  MISS ${locale} "${probe.query}" -> ${got}`)
        }
      }
    }
  }
}

await main()
