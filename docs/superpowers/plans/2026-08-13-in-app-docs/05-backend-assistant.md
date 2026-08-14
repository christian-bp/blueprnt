# Phase 5: Convex Sync and Assistant Grounding (guards 8-10)

> Part of `docs/superpowers/plans/2026-08-13-in-app-docs/` (read `00-overview.md` first). Global constraints apply to every task. Backend code follows `packages/backend/convex/_generated/ai/guidelines.md`.

**Goal:** The docs corpus chunked into a Convex search table, a `search_docs` tool grounding the assistant, the prompt updated, ADR-0019 written, and the whole path verified on the dev deployment in a browser.

### Task 5.1: Chunker

**Files:**
- Create: `apps/dashboard/lib/docs/chunk.ts`
- Test: `apps/dashboard/lib/docs/chunk.test.ts`

**Interfaces:**
- Consumes: `headingAnchor` from `@/lib/docs/anchors` (the shared slugifier, see Phase 2 Task 2.3), `DocFrontmatter` (2.1).
- Produces: `chunkDocPage({ body, frontmatter }): DocChunk[]` with `DocChunk = { section: string; pageTitle: string; heading: string | null; anchor: string | null; text: string; order: number }`. Consumed by the sync script (5.4); its shape mirrors the Convex validator (5.2).

- [ ] **Step 1: Write the failing tests**

`apps/dashboard/lib/docs/chunk.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { headingAnchor } from "./anchors"
import { chunkDocPage } from "./chunk"

const frontmatter = {
  title: "Weighting",
  description: "d",
  section: "model",
  order: 3,
}

describe("chunkDocPage", () => {
  it("emits an intro chunk and one chunk per H2, anchors matching the renderer", () => {
    const body = [
      "Intro paragraph.",
      "",
      "## Point budget",
      "The budget is criteria count x 3.",
      "",
      "### Sub detail",
      "Folded into the parent chunk.",
      "",
      "## Saving",
      "Save posts atomically.",
    ].join("\n")
    const chunks = chunkDocPage({ body, frontmatter })
    expect(chunks.map((c) => c.heading)).toEqual([null, "Point budget", "Saving"])
    expect(chunks[1]?.anchor).toBe(headingAnchor("Point budget"))
    expect(chunks[1]?.text).toContain("criteria count x 3")
    expect(chunks[1]?.text).toContain("Folded into the parent chunk.")
    expect(chunks.map((c) => c.order)).toEqual([0, 1, 2])
    for (const c of chunks) {
      expect(c.pageTitle).toBe("Weighting")
      expect(c.section).toBe("model")
    }
  })

  it("strips markdown syntax to plain text but keeps link text", () => {
    const body = "## A\nSee [the roles page](/roles) and use `Add role` with **care**."
    const [chunk] = chunkDocPage({ body, frontmatter })
    expect(chunk?.text).toContain("the roles page")
    expect(chunk?.text).toContain("Add role")
    expect(chunk?.text).not.toMatch(/[[\]()*`]/)
  })

  it("skips an empty intro and splits sections longer than 2000 chars at a paragraph boundary", () => {
    const long = Array.from({ length: 30 }, (_, i) => `Paragraph ${i} ${"x".repeat(80)}.`).join("\n\n")
    const chunks = chunkDocPage({ body: `## Long\n${long}`, frontmatter })
    expect(chunks[0]?.heading).toBe("Long")
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(2000)
      expect(c.heading).toBe("Long")
      expect(c.anchor).toBe(headingAnchor("Long"))
    }
    expect(chunks.map((c) => c.order)).toEqual(chunks.map((_, i) => i))
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/dashboard && bun run test -- lib/docs/chunk.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`apps/dashboard/lib/docs/chunk.ts`:

```ts
import { headingAnchor } from "./anchors"
import type { DocFrontmatter } from "./frontmatter"

export interface DocChunk {
  section: string
  pageTitle: string
  heading: string | null
  anchor: string | null
  text: string
  order: number
}

const MAX_CHUNK_CHARS = 2000

// Markdown to searchable plain text: link text survives, syntax does not.
function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^#{2,6}\s+/gm, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/^\s*[|-]{2,}.*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim()
}

function split(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text]
  const parts: string[] = []
  let current = ""
  for (const paragraph of text.split("\n\n")) {
    if (current !== "" && current.length + paragraph.length + 2 > MAX_CHUNK_CHARS) {
      parts.push(current)
      current = paragraph
    } else {
      current = current === "" ? paragraph : `${current}\n\n${paragraph}`
    }
  }
  if (current !== "") parts.push(current)
  return parts
}

export function chunkDocPage(args: {
  body: string
  frontmatter: DocFrontmatter
}): DocChunk[] {
  const sections: { heading: string | null; lines: string[] }[] = [
    { heading: null, lines: [] },
  ]
  for (const line of args.body.split("\n")) {
    const h2 = /^##\s+(.+)$/.exec(line)
    if (h2?.[1] !== undefined) sections.push({ heading: h2[1], lines: [] })
    else sections.at(-1)?.lines.push(line)
  }
  const chunks: DocChunk[] = []
  for (const section of sections) {
    const plain = stripMarkdown(section.lines.join("\n"))
    if (plain === "") continue
    // The heading is part of the text so a search for its words hits.
    const withHeading = section.heading === null ? plain : `${section.heading}\n${plain}`
    for (const text of split(withHeading)) {
      chunks.push({
        section: args.frontmatter.section,
        pageTitle: args.frontmatter.title,
        heading: section.heading,
        anchor: section.heading === null ? null : headingAnchor(section.heading),
        text,
        order: chunks.length,
      })
    }
  }
  return chunks
}
```

- [ ] **Step 4: Run to verify pass** (`bun run test -- lib/docs/chunk.test.ts`). Adjust the strip regexes against the failures the real corpus surfaces (tables and blockquotes must come out as readable sentences), keeping the tests strict. Leave staged-ready.

### Task 5.2: Convex `docs` context (table + sync mutations, guard 8 backend half)

**Files:**
- Create: `packages/backend/convex/docs/tables.ts`
- Create: `packages/backend/convex/docs/sync.ts`
- Modify: `packages/backend/convex/schema.ts` (import + register `docsChunks`)
- Test: `packages/backend/convex/docs/sync.test.ts`

**Interfaces:**
- Produces: table `docsChunks`; `internal.docs.sync.replacePage({ locale, slug, pageHash, chunks }) -> boolean` (true = wrote, false = hash-skipped); `internal.docs.sync.sweepLocale({ locale, keepSlugs }) -> number` (deleted count). Consumed by the sync script (5.4).
- No audit rows: the sync is deploy-time content, not a user-initiated change to domain state (outside the audit rule's scope; ADR-0019 states this).

- [ ] **Step 1: Write the failing tests**

`packages/backend/convex/docs/sync.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

const page = (over: Partial<{ locale: string; slug: string; pageHash: string }> = {}) => ({
  locale: "en",
  slug: "weighting-and-point-budget",
  pageHash: "hash-1",
  chunks: [
    {
      section: "model",
      pageTitle: "Weighting",
      heading: null,
      anchor: null,
      text: "Weight points are 1-5 under a fixed point budget.",
      order: 0,
    },
    {
      section: "model",
      pageTitle: "Weighting",
      heading: "Point budget",
      anchor: "point-budget",
      text: "Point budget The budget is criteria count x 3, exact sum.",
      order: 1,
    },
  ],
  ...over,
})

describe("docs.sync.replacePage", () => {
  it("inserts, then hash-skips an identical second run", async () => {
    const t = initConvexTest()
    expect(await t.mutation(internal.docs.sync.replacePage, page())).toBe(true)
    expect(await t.mutation(internal.docs.sync.replacePage, page())).toBe(false)
  })

  it("replaces all chunks when the hash changes", async () => {
    const t = initConvexTest()
    await t.mutation(internal.docs.sync.replacePage, page())
    const changed = page({ pageHash: "hash-2" })
    changed.chunks = [changed.chunks[0]!]
    expect(await t.mutation(internal.docs.sync.replacePage, changed)).toBe(true)
    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("docsChunks")
        .withIndex("by_locale_slug", (q) =>
          q.eq("locale", "en").eq("slug", "weighting-and-point-budget")
        )
        .collect()
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.pageHash).toBe("hash-2")
  })
})

describe("docs.sync.sweepLocale", () => {
  it("removes chunks for retired slugs in the locale only", async () => {
    const t = initConvexTest()
    await t.mutation(internal.docs.sync.replacePage, page())
    await t.mutation(internal.docs.sync.replacePage, page({ slug: "retired-page" }))
    await t.mutation(internal.docs.sync.replacePage, page({ locale: "sv" }))
    const deleted = await t.mutation(internal.docs.sync.sweepLocale, {
      locale: "en",
      keepSlugs: ["weighting-and-point-budget"],
    })
    expect(deleted).toBe(2)
    const svRows = await t.run(async (ctx) =>
      ctx.db
        .query("docsChunks")
        .withIndex("by_locale_slug", (q) => q.eq("locale", "sv"))
        .collect()
    )
    expect(svRows).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/backend && bun run test -- convex/docs/sync.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement table and schema**

`packages/backend/convex/docs/tables.ts`:

```ts
import { defineTable } from "convex/server"
import { v } from "convex/values"

// Derived cache of apps/dashboard/content/docs (ADR-0019): rebuilt by
// `bun run docs:sync`, never edited by hand, no PII, org-independent.
export const docsChunks = defineTable({
  locale: v.string(),
  slug: v.string(),
  section: v.string(),
  pageTitle: v.string(),
  heading: v.union(v.string(), v.null()),
  anchor: v.union(v.string(), v.null()),
  text: v.string(),
  order: v.number(),
  pageHash: v.string(),
})
  .index("by_locale_slug", ["locale", "slug"])
  .searchIndex("search_text", {
    searchField: "text",
    filterFields: ["locale"],
  })
```

In `packages/backend/convex/schema.ts`: `import { docsChunks } from "./docs/tables"` and add `docsChunks,` to `defineSchema`.

- [ ] **Step 4: Implement mutations**

`packages/backend/convex/docs/sync.ts`:

```ts
import { v } from "convex/values"
import { internalMutation } from "../_generated/server"

const chunkValidator = v.object({
  section: v.string(),
  pageTitle: v.string(),
  heading: v.union(v.string(), v.null()),
  anchor: v.union(v.string(), v.null()),
  text: v.string(),
  order: v.number(),
})

// One page per call keeps every transaction bounded (a page is ~10 chunks).
export const replacePage = internalMutation({
  args: {
    locale: v.string(),
    slug: v.string(),
    pageHash: v.string(),
    chunks: v.array(chunkValidator),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("docsChunks")
      .withIndex("by_locale_slug", (q) =>
        q.eq("locale", args.locale).eq("slug", args.slug)
      )
      .collect()
    if (
      existing.length === args.chunks.length &&
      existing[0]?.pageHash === args.pageHash
    ) {
      return false
    }
    for (const doc of existing) await ctx.db.delete(doc._id)
    for (const chunk of args.chunks) {
      await ctx.db.insert("docsChunks", {
        ...chunk,
        locale: args.locale,
        slug: args.slug,
        pageHash: args.pageHash,
      })
    }
    return true
  },
})

// Content-scale (hundreds of rows per locale), not org-scale: a single
// bounded transaction per locale is fine here.
export const sweepLocale = internalMutation({
  args: { locale: v.string(), keepSlugs: v.array(v.string()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const keep = new Set(args.keepSlugs)
    const rows = await ctx.db
      .query("docsChunks")
      .withIndex("by_locale_slug", (q) => q.eq("locale", args.locale))
      .collect()
    let deleted = 0
    for (const row of rows) {
      if (!keep.has(row.slug)) {
        await ctx.db.delete(row._id)
        deleted += 1
      }
    }
    return deleted
  },
})
```

- [ ] **Step 5: Run to verify pass** (`cd packages/backend && bun run test -- convex/docs/sync.test.ts`). Leave staged-ready.

### Task 5.3: Search query (guard 9 backend half)

**Files:**
- Create: `packages/backend/convex/docs/search.ts`
- Test: `packages/backend/convex/docs/search.test.ts`

**Interfaces:**
- Consumes: `docsChunks` (5.2).
- Produces: `internal.docs.search.searchDocs({ locale, query }) -> { pageTitle, heading, path, text }[]` (max 5; `path` is `/docs/<slug>` or `/docs/<slug>#<anchor>`). Consumed by the tool (5.5).

- [ ] **Step 1: Write the failing tests**

`packages/backend/convex/docs/search.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seed(t: ReturnType<typeof initConvexTest>) {
  await t.mutation(internal.docs.sync.replacePage, {
    locale: "en",
    slug: "weighting-and-point-budget",
    pageHash: "h",
    chunks: [
      {
        section: "model",
        pageTitle: "Weighting",
        heading: "Point budget",
        anchor: "point-budget",
        text: "Point budget The budget is criteria count x 3, exact sum.",
        order: 0,
      },
    ],
  })
  await t.mutation(internal.docs.sync.replacePage, {
    locale: "sv",
    slug: "weighting-and-point-budget",
    pageHash: "h",
    chunks: [
      {
        section: "model",
        pageTitle: "Viktning",
        heading: "Poängbudget",
        anchor: "poangbudget",
        text: "Poängbudget Budgeten är antal kriterier gånger tre.",
        order: 0,
      },
    ],
  })
}

describe("docs.search.searchDocs", () => {
  it("searches the caller's locale and builds anchored paths", async () => {
    const t = initConvexTest()
    await seed(t)
    const hits = await t.query(internal.docs.search.searchDocs, {
      locale: "sv",
      query: "poängbudget",
    })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]?.pageTitle).toBe("Viktning")
    expect(hits[0]?.path).toBe("/docs/weighting-and-point-budget#poangbudget")
  })

  it("falls back to en when the locale has no hits", async () => {
    const t = initConvexTest()
    await seed(t)
    const hits = await t.query(internal.docs.search.searchDocs, {
      locale: "fi",
      query: "point budget",
    })
    expect(hits[0]?.pageTitle).toBe("Weighting")
  })

  it("returns at most five results", async () => {
    const t = initConvexTest()
    for (let i = 0; i < 8; i += 1) {
      await t.mutation(internal.docs.sync.replacePage, {
        locale: "en",
        slug: `page-${i}`,
        pageHash: "h",
        chunks: [
          {
            section: "model",
            pageTitle: `Page ${i}`,
            heading: null,
            anchor: null,
            text: "budget budget budget",
            order: 0,
          },
        ],
      })
    }
    const hits = await t.query(internal.docs.search.searchDocs, {
      locale: "en",
      query: "budget",
    })
    expect(hits.length).toBeLessThanOrEqual(5)
  })
})
```

- [ ] **Step 2: Run to verify failure**, then implement `packages/backend/convex/docs/search.ts`:

```ts
import { v } from "convex/values"
import { internalQuery } from "../_generated/server"

const hitValidator = v.object({
  pageTitle: v.string(),
  heading: v.union(v.string(), v.null()),
  path: v.string(),
  text: v.string(),
})

export const searchDocs = internalQuery({
  args: { locale: v.string(), query: v.string() },
  returns: v.array(hitValidator),
  handler: async (ctx, args) => {
    const run = (locale: string) =>
      ctx.db
        .query("docsChunks")
        .withSearchIndex("search_text", (q) =>
          q.search("text", args.query).eq("locale", locale)
        )
        .take(5)
    let hits = await run(args.locale)
    if (hits.length === 0 && args.locale !== "en") hits = await run("en")
    return hits.map((chunk) => ({
      pageTitle: chunk.pageTitle,
      heading: chunk.heading,
      path:
        chunk.anchor === null
          ? `/docs/${chunk.slug}`
          : `/docs/${chunk.slug}#${chunk.anchor}`,
      text: chunk.text,
    }))
  },
})
```

- [ ] **Step 3: Run to verify pass**. Leave staged-ready.

### Task 5.4: Sync script

**Files:**
- Create: `apps/dashboard/scripts/sync-docs.ts`
- Modify: `apps/dashboard/package.json` (add script `"docs:sync": "bun run scripts/sync-docs.ts"`)

**Interfaces:**
- Consumes: `chunkDocPage` (5.1), `docFrontmatterSchema` (2.1), `internal.docs.sync.*` via the Convex CLI (which reads `packages/backend/.env.local` for the target deployment; prod runs set `CONVEX_DEPLOY_KEY`).

- [ ] **Step 1: Implement**

`apps/dashboard/scripts/sync-docs.ts`:

```ts
import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { chunkDocPage } from "../lib/docs/chunk"
import { docFrontmatterSchema } from "../lib/docs/frontmatter"
import { parseMdx } from "../lib/docs/parse-mdx"

const CONTENT_ROOT = new URL("../content/docs/", import.meta.url).pathname
const BACKEND_DIR = new URL("../../../packages/backend", import.meta.url).pathname

async function convexRun(fn: string, args: unknown): Promise<string> {
  const proc = Bun.spawn(["bunx", "convex", "run", fn, JSON.stringify(args)], {
    cwd: BACKEND_DIR,
    stdout: "pipe",
    stderr: "pipe",
  })
  if ((await proc.exited) !== 0) {
    throw new Error(`${fn} failed: ${await new Response(proc.stderr).text()}`)
  }
  return await new Response(proc.stdout).text()
}

const locales = (await readdir(CONTENT_ROOT, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

for (const locale of locales) {
  const files = (await readdir(path.join(CONTENT_ROOT, locale))).filter((f) =>
    f.endsWith(".mdx")
  )
  const slugs: string[] = []
  for (const file of files) {
    const slug = file.replace(/\.mdx$/, "")
    slugs.push(slug)
    const raw = await readFile(path.join(CONTENT_ROOT, locale, file), "utf8")
    const { data, content } = parseMdx(raw)
    const frontmatter = docFrontmatterSchema.parse(data)
    const wrote = await convexRun("docs/sync:replacePage", {
      locale,
      slug,
      pageHash: createHash("sha256").update(raw).digest("hex"),
      chunks: chunkDocPage({ body: content, frontmatter }),
    })
    console.log(`${locale}/${slug}: ${wrote.includes("true") ? "synced" : "unchanged"}`)
  }
  const swept = await convexRun("docs/sync:sweepLocale", { locale, keepSlugs: slugs })
  console.log(`${locale}: swept ${swept.trim()}`)
}
```

- [ ] **Step 2: Verify against the dev deployment**

Run: `cd packages/backend && bunx convex dev --once` (pushes the schema), then `cd apps/dashboard && bun run docs:sync`.
Expected: one "synced" line per locale/page; re-running prints "unchanged" for every page. Check the row count in the Convex dashboard (`docsChunks` roughly 56 pages x 5 locales x 3-10 chunks).

### Task 5.5: `search_docs` tool and prompt update (guard 10)

**Files:**
- Modify: `packages/backend/convex/assistant/tools.ts` (locale arg + new tool)
- Modify: `packages/backend/convex/assistant/generate.ts:155` (pass `locale: args.locale` to `buildAssistantTools`)
- Modify: `packages/backend/convex/assistant/knowledge.ts` (Pages list + tool rules)
- Test: `packages/backend/convex/assistant/knowledge.test.ts` (extend)

**Interfaces:**
- Consumes: `internal.docs.search.searchDocs` (5.3).
- Produces: the tool the model calls; `buildAssistantTools(ctx, { orgId: string; locale: string })` (signature change; `generate.ts` is the only caller).

- [ ] **Step 1: Write the failing prompt tests**

Append to `packages/backend/convex/assistant/knowledge.test.ts`:

```ts
it("lists the docs page and teaches the docs search rule", () => {
  const prompt = assistantSystemPrompt({ locale: "en" })
  expect(prompt).toContain("(/docs)")
  expect(prompt).toContain("search_docs")
  expect(prompt).toContain("documentation does not cover it yet")
})
```

Run: `cd packages/backend && bun run test -- convex/assistant/knowledge.test.ts`
Expected: FAIL.

- [ ] **Step 2: Update `knowledge.ts`**

Pages list, after the Audit log line:

```ts
    "- Documentation (/docs): the in-app user guide; individual guides live at /docs/<slug> and can be linked directly.",
```

Tools section, after the suppression line:

```ts
    "- search_docs: search the product documentation in the user's language. Use it for any question about how to use the product, what a concept means, where something is done, or what an error message means. Answer from the results and link the page with its path from the result (example: [Weighting](/docs/weighting-and-point-budget)). If the search returns nothing relevant, answer from the Core concepts above and say the documentation does not cover it yet.",
```

- [ ] **Step 3: Update `tools.ts`**

Change the signature to `buildAssistantTools(ctx: ActionCtx, args: { orgId: string; locale: string })` and add:

```ts
    search_docs: tool({
      description:
        "Search the product documentation in the user's language. Use for questions about how to use the product, what a concept means, where something is done, or what an error message means. Returns documentation excerpts with the page path to link.",
      inputSchema: z.object({
        query: z.string().describe("Search terms for the documentation."),
      }),
      execute: async (input) =>
        await ctx.runQuery(internal.docs.search.searchDocs, {
          locale: args.locale,
          query: input.query,
        }),
    }),
```

`search_docs` stays OUT of `VISUAL_TOOL_CHARTS` (numbers/text only, no chart part).

- [ ] **Step 4: Update the caller**

In `generate.ts`, the `streamText` options: `tools: buildAssistantTools(ctx, { orgId: args.orgId, locale: args.locale }),`

- [ ] **Step 5: Run backend tests**

Run: `cd packages/backend && bun run test`
Expected: PASS, including the extended knowledge tests and `chat.test.ts` unchanged. If `chat.test.ts` already stubs the generation loop with a tool harness, add one case asserting `search_docs` appears in the built tool set: `expect(Object.keys(buildAssistantTools(ctx, { orgId: "o", locale: "sv" }))).toContain("search_docs")`; otherwise the query tests (5.3) plus the prompt tests cover the seam (the tool body is one `runQuery` line).

- [ ] **Step 6: Dashboard guard 5 re-run**

Run: `cd apps/dashboard && bun run test -- lib/docs/docs-guards.test.ts -t "guard 5"`
Expected: PASS with 10 paths (the new `/docs` line resolves against the route created in Phase 2).

### Task 5.6: ADR-0019, dev deployment, browser verification

**Files:**
- Create: `docs/adr/0019-dokumentation-i-appen.md`

- [ ] **Step 1: Write the ADR** (Swedish, format per the existing ADRs):

```markdown
# 19. Dokumentation i appen som assistentens kunskapskälla

Status: Föreslagen
Datum: 2026-08-13

## Kontext

Produkten saknade användarvänd dokumentation, och assistentens produktkunskap
låg enbart i en handskriven systemprompt (ADR-0018) som driftar när produkten
ändras. Vi ville ha en omfattande hjälpyta i appen och en assistent som svarar
ur samma källa, på alla fem språk.

## Beslut

- MDX-filer per locale i `apps/dashboard/content/docs/{en,sv,nb,da,fi}` är
  dokumentationens enda källa. Engelska är källspråket; övriga locales är
  maskinutkast flaggade för native-granskning (go-live-checklistan).
- Dokumentationen renderas i appen på `/docs` och `/docs/[slug]`, bakom
  inloggning, med navstruktur i kod och titlar enbart i frontmatter.
- Convex-tabellen `docsChunks` är en HÄRLEDD cache av MDX-filerna (chunk per
  H2-rubrik, fulltextindex per locale), återuppbyggbar när som helst via
  `bun run docs:sync`. Den redigeras aldrig för hand och innehåller ingen
  persondata, så ingen raderingskrok behövs.
- Synken är deploy-innehåll, inte en användarinitierad domänändring: den
  skriver ingen auditrad (utanför auditregelns omfång i CLAUDE.md).
- Assistenten får ett femte read-only-verktyg, `search_docs`, som söker i
  användarens locale med fallback till engelska och länkar dokumentsidan.
  ADR-0018:s invarianter kvarstår oförändrade: enbart läsande verktyg, aldrig
  persondata i prompt, AI-anrop endast i Convex actions mot EU-hostade
  modeller, ingen skrivåtkomst.
- Systemprompten förblir identitets- och gränslagret (kärnbegrepp,
  sidlista, regler); djupet bor i dokumentationen.

## Konsekvenser

- En ny produktyta eller ett nytt begrepp ska uppdatera dokumentationen i
  samma ändring; tio driftvakter (paritet, nav, länkar, termtäckning,
  feltäckning, prompt-rutter m.fl.) gör utebliven uppdatering till ett rött
  test i stället för en tyst drift.
- Deployflödet kör `bun run docs:sync` efter `convex deploy` så cachen
  följer innehållet (go-live-checklistan spårar CI-kopplingen).
- Framtida steg om fulltextens träffbild inte räcker: semantisk sökning med
  EU-hostade embeddings, som ett utbyte av sökmotorn bakom samma verktyg.
```

- [ ] **Step 2: Browser verification pass** (dev deployment, after Tasks 5.4-5.5 and a `bun run docs:sync`)

1. Ask the assistant (in Swedish): "Hur fungerar viktpoäng och poängbudgeten?" Expected: an answer grounded in the docs with a working `/docs/...` link, and the "checking your data" shimmer during the tool call.
2. Click the link: the docs page opens at the right anchor.
3. Ask about an error: "Varför får jag felet att viktningen inte är balanserad?" Expected: an answer citing the troubleshooting page.
4. Ask something the docs do not cover (e.g. "Kan ni exportera till Excel?"): expected: the honest fallback wording, no invented docs link.
5. Verify the call landed in `/admin/ai-usage` (kind `assistant.chat`).

- [ ] **Step 3: Full gate** `bun run test` (root), `bun run lint`, `bun run typecheck`. Leave staged-ready.
