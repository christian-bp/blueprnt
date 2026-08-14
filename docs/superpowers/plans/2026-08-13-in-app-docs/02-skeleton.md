# Phase 2: Docs Skeleton (loader, renderer, routes, guards 1-4)

> Part of `docs/superpowers/plans/2026-08-13-in-app-docs/` (read `00-overview.md` first). Global constraints apply to every task.

**Goal:** A working `/docs` surface: MDX pipeline, structure-only navigation, article + index routes inside the app shell, sidebar entry, i18n chrome in all five locales, three seed pages per locale, and drift guards 1-4 green.

### Task 2.1: Dependencies and frontmatter schema

**Files:**
- Modify: `apps/dashboard/package.json` (dependencies)
- Create: `apps/dashboard/lib/docs/frontmatter.ts`
- Test: `apps/dashboard/lib/docs/frontmatter.test.ts`

**Interfaces:**
- Produces: `docFrontmatterSchema` (Zod), `type DocFrontmatter = { title: string; description: string; section: string; order: number }`. Consumed by the loader (2.2), guards (2.7), and the chunker (Phase 5).

- [ ] **Step 1: Add dependencies**

```bash
cd apps/dashboard && bun add next-mdx-remote@^6.0.0 remark-gfm@^4.0.1 js-yaml@^4.3.1 && bun add -d @types/js-yaml
```

(Corrected during execution: gray-matter cannot be used, the root security overrides pin js-yaml to 4.x which removes the v3 API gray-matter calls. Frontmatter is split by `lib/docs/parse-mdx.ts` and parsed by js-yaml's `load`.)

- [ ] **Step 2: Write the failing test**

`apps/dashboard/lib/docs/frontmatter.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { docFrontmatterSchema } from "./frontmatter"

describe("docFrontmatterSchema", () => {
  it("accepts the midday-shaped frontmatter", () => {
    expect(
      docFrontmatterSchema.parse({
        title: "Introduction",
        description: "What blueprnt is.",
        section: "getting-started",
        order: 1,
      })
    ).toEqual({
      title: "Introduction",
      description: "What blueprnt is.",
      section: "getting-started",
      order: 1,
    })
  })

  it("rejects missing description and non-integer order", () => {
    expect(() =>
      docFrontmatterSchema.parse({ title: "X", section: "s", order: 1 })
    ).toThrow()
    expect(() =>
      docFrontmatterSchema.parse({
        title: "X",
        description: "Y",
        section: "s",
        order: 1.5,
      })
    ).toThrow()
  })

  it("rejects unknown keys so frontmatter stays midday-minimal", () => {
    expect(() =>
      docFrontmatterSchema.parse({
        title: "X",
        description: "Y",
        section: "s",
        order: 1,
        draft: true,
      })
    ).toThrow()
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `cd apps/dashboard && bun run test -- lib/docs/frontmatter.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement**

`apps/dashboard/lib/docs/frontmatter.ts`:

```ts
import { z } from "zod"

// Exactly midday's frontmatter shape; strict so stray fields fail in tests
// instead of silently shipping.
export const docFrontmatterSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    section: z.string().min(1),
    order: z.number().int().min(1),
  })
  .strict()

export type DocFrontmatter = z.infer<typeof docFrontmatterSchema>
```

- [ ] **Step 5: Run to verify pass, then leave staged-ready**

Run: `cd apps/dashboard && bun run test -- lib/docs/frontmatter.test.ts`
Expected: PASS.

### Task 2.2: Navigation structure and loader

**Files:**
- Create: `apps/dashboard/lib/docs/docs-nav.ts`
- Create: `apps/dashboard/lib/docs/docs.ts`
- Test: `apps/dashboard/lib/docs/docs.test.ts`

**Interfaces:**
- Consumes: `docFrontmatterSchema` (2.1).
- Produces:
  - `DOCS_NAV: { section: string; pages: string[] }[]` (structure only, no titles)
  - `SECTION_LABEL_KEYS: Record<sectionSlug, "sections.<camelCase>">` (typed i18n key per section)
  - `POPULAR_DOCS: string[]`
  - `allDocSlugs(): string[]` (nav order, flattened; the prev/next order)
  - `getDoc(locale: string, slug: string): Promise<Doc | null>` where `Doc = { slug: string; frontmatter: DocFrontmatter; body: string }`
  - `getAdjacentDocs(slug: string): { previous: string | null; next: string | null }`

- [ ] **Step 1: Write the failing test**

`apps/dashboard/lib/docs/docs.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getAdjacentDocs, getDoc } from "./docs"
import { allDocSlugs, DOCS_NAV, SECTION_LABEL_KEYS } from "./docs-nav"

describe("docs nav structure", () => {
  it("flattens slugs in nav order and has a label key per section", () => {
    const slugs = allDocSlugs()
    expect(slugs.length).toBeGreaterThan(0)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of DOCS_NAV) {
      expect(SECTION_LABEL_KEYS[s.section]).toBeDefined()
    }
  })
})

describe("getDoc", () => {
  it("returns null for a slug that is not in the nav (URL safety)", async () => {
    expect(await getDoc("en", "../../../etc/passwd")).toBeNull()
    expect(await getDoc("en", "does-not-exist")).toBeNull()
  })

  it("loads a seed page with parsed frontmatter and body", async () => {
    const doc = await getDoc("en", "introduction")
    expect(doc).not.toBeNull()
    expect(doc?.frontmatter.section).toBe("getting-started")
    expect(doc?.body).toContain("#")
  })
})

describe("getAdjacentDocs", () => {
  it("walks the flattened nav order with null at the ends", () => {
    const slugs = allDocSlugs()
    expect(getAdjacentDocs(slugs[0] ?? "").previous).toBeNull()
    expect(getAdjacentDocs(slugs.at(-1) ?? "").next).toBeNull()
    if (slugs.length >= 2) {
      expect(getAdjacentDocs(slugs[0] ?? "").next).toBe(slugs[1])
    }
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/dashboard && bun run test -- lib/docs/docs.test.ts`
Expected: FAIL (modules not found). Note: `getDoc` tests need Task 2.6's seed file; until then they fail on the null assertion too, which is fine, re-run after 2.6.

- [ ] **Step 3: Implement the nav**

`apps/dashboard/lib/docs/docs-nav.ts` (Phase 2 ships the three seed pages only; Phase 3 tasks extend this file section by section, in the spec's section order):

```ts
// section is keyed to SECTION_LABEL_KEYS (declared below; interfaces may
// reference a later const in type position) so indexing the label map with
// a nav entry's section typechecks under strict without casts. (Corrected
// during execution: `section: string` fails TS7053 in docs.test.ts.)
export interface DocsSection {
  section: keyof typeof SECTION_LABEL_KEYS
  pages: string[]
}

// Structure ONLY. Page titles live in each locale's frontmatter, section
// labels in dashboard.docs.sections.* (midday duplicates titles between
// frontmatter and nav; we deliberately do not).
export const DOCS_NAV: DocsSection[] = [
  { section: "getting-started", pages: ["introduction"] },
  { section: "evaluation", pages: ["evaluating-a-role"] },
  { section: "people", pages: ["importing-people"] },
]

// Typed message key per section slug; keys are camelCase because message
// keys never contain hyphens. All 12 keys exist from Phase 2 so the corpus
// phase only touches pages.
export const SECTION_LABEL_KEYS = {
  "getting-started": "sections.gettingStarted",
  model: "sections.model",
  roles: "sections.roles",
  evaluation: "sections.evaluation",
  people: "sections.people",
  "pay-mapping": "sections.payMapping",
  assistant: "sections.assistant",
  organization: "sections.organization",
  account: "sections.account",
  "security-privacy": "sections.securityPrivacy",
  glossary: "sections.glossary",
  troubleshooting: "sections.troubleshooting",
} as const

export const POPULAR_DOCS: string[] = [
  "introduction",
  "evaluating-a-role",
  "importing-people",
]

export function allDocSlugs(): string[] {
  return DOCS_NAV.flatMap((s) => s.pages)
}
```

- [ ] **Step 4: Implement the loader**

`apps/dashboard/lib/docs/docs.ts`:

```ts
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
```

- [ ] **Step 5: Re-run after Task 2.6; leave staged-ready**

### Task 2.3: Anchor module and MDX renderer

**Files:**
- Create: `apps/dashboard/lib/docs/anchors.ts`
- Create: `apps/dashboard/components/docs/mdx.tsx`

**Interfaces:**
- Consumes: `slugify` from `@workspace/constants`.
- Produces: `headingAnchor(text: string): string` in `lib/docs/anchors.ts`, the ONE anchor rule shared by the renderer, the link guard (2.7), and Phase 5's chunker and sync script (which must never import the MDX renderer's heavy dependencies). `DocsMdx({ body }: { body: string })`, a server component.

- [ ] **Step 1: Anchor module**

`apps/dashboard/lib/docs/anchors.ts`:

```ts
import { slugify } from "@workspace/constants"

// The single anchor rule: renderer, chunker, and the link guard all call
// this. Docs headings are plain text by convention (guarded by the chunker
// tests), so plain string slugification is the whole rule.
export function headingAnchor(text: string): string {
  return slugify(text)
}
```

- [ ] **Step 2: Implement the renderer**

`apps/dashboard/components/docs/mdx.tsx` (server component, no `"use client"`):

```tsx
import { MDXRemote } from "next-mdx-remote/rsc"
import Link from "next/link"
import type { ComponentPropsWithoutRef, ReactNode } from "react"
import remarkGfm from "remark-gfm"
import { headingAnchor } from "@/lib/docs/anchors"

function createHeading(level: 2 | 3 | 4) {
  const Tag = `h${level}` as const
  const size = {
    2: "mt-10 mb-4 text-xl font-semibold",
    3: "mt-8 mb-3 text-lg font-semibold",
    4: "mt-6 mb-2 text-base font-semibold",
  }[level]
  return function Heading({ children }: { children?: ReactNode }) {
    const id = headingAnchor(String(children))
    return (
      <Tag id={id} className={`group scroll-mt-24 ${size}`}>
        {children}
        <a
          href={`#${id}`}
          aria-hidden="true"
          className="ml-2 opacity-0 transition-opacity group-hover:opacity-60"
        >
          #
        </a>
      </Tag>
    )
  }
}

function CustomLink(props: ComponentPropsWithoutRef<"a">) {
  const href = props.href ?? ""
  const className = "text-brand underline-offset-4 hover:underline"
  if (href.startsWith("/")) {
    return <Link {...props} href={href} className={className} />
  }
  if (href.startsWith("#")) return <a {...props} className={className} />
  return (
    <a {...props} target="_blank" rel="noopener noreferrer" className={className} />
  )
}

const components = {
  h2: createHeading(2),
  h3: createHeading(3),
  h4: createHeading(4),
  a: CustomLink,
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="my-4 leading-7 text-foreground" {...props} />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul className="my-4 list-disc space-y-2 pl-6" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol className="my-4 list-decimal space-y-2 pl-6" {...props} />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="my-4 border-l-2 border-border pl-4 text-muted-foreground"
      {...props}
    />
  ),
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code
      className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
      {...props}
    />
  ),
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full text-sm" {...props} />
    </div>
  ),
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th className="border-b border-border px-3 py-2 text-left font-medium" {...props} />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td className="border-b border-border px-3 py-2 align-top" {...props} />
  ),
  hr: () => <hr className="my-8 border-border" />,
}

export function DocsMdx({ body }: { body: string }) {
  return (
    <MDXRemote
      source={body}
      components={components}
      options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
    />
  )
}
```

Wide tables scroll inside their own container (the `overflow-x-auto` wrapper) per the repo layout rule. Links carry `text-brand` per the brand rule. No h1 in the map: the page owns its `<h1>` from frontmatter, and the corpus convention starts bodies at `##`.

- [ ] **Step 3: Typecheck**

Run: `cd apps/dashboard && bun run typecheck`
Expected: clean. (Rendering is verified through the routes in Task 2.4 and the browser pass in Phase 5.)

### Task 2.4: Routes and Next config

**Files:**
- Create: `apps/dashboard/app/(app)/docs/page.tsx`
- Create: `apps/dashboard/app/(app)/docs/[slug]/page.tsx`
- Create: `apps/dashboard/components/docs/docs-sidebar.tsx`
- Modify: `apps/dashboard/next.config.ts` (add `outputFileTracingIncludes`)

**Interfaces:**
- Consumes: `getDoc`, `getAdjacentDocs`, `DOCS_NAV`, `SECTION_LABEL_KEYS`, `POPULAR_DOCS` (2.2); `DocsMdx` (2.3); `AssistantPrompt` (existing, prop-free); `getLocale`/`getTranslations` from `next-intl/server`.
- Produces: the `/docs` and `/docs/[slug]` routes later linked by the app sidebar (2.5), the assistant prompt (Phase 5), and every internal docs link.

- [ ] **Step 1: Next config**

In `apps/dashboard/next.config.ts`, add to `nextConfig` (top level, beside `transpilePackages`):

```ts
  // Docs MDX is read from the filesystem at request time (locale is a
  // cookie, so these routes render dynamically); without tracing the files
  // are absent from the serverless bundle.
  outputFileTracingIncludes: {
    "/docs": ["./content/docs/**/*"],
    "/docs/[slug]": ["./content/docs/**/*"],
  },
```

- [ ] **Step 2: Docs sidebar component**

`apps/dashboard/components/docs/docs-sidebar.tsx` (server component; native `<details>` gives the accordion with zero client JS):

```tsx
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { getDoc } from "@/lib/docs/docs"
import { DOCS_NAV, SECTION_LABEL_KEYS } from "@/lib/docs/docs-nav"

export async function DocsSidebar({
  locale,
  currentSlug,
}: {
  locale: string
  currentSlug: string
}) {
  const t = await getTranslations("dashboard.docs")
  return (
    <nav aria-label={t("index.title")} className="hidden w-56 shrink-0 lg:block">
      <ul className="space-y-1">
        {await Promise.all(
          DOCS_NAV.map(async (section) => {
            const docs = await Promise.all(
              section.pages.map((slug) => getDoc(locale, slug))
            )
            const isCurrent = section.pages.includes(currentSlug)
            return (
              <li key={section.section}>
                <details open={isCurrent}>
                  <summary className="cursor-pointer py-1.5 text-sm font-medium">
                    {t(SECTION_LABEL_KEYS[section.section as keyof typeof SECTION_LABEL_KEYS])}
                  </summary>
                  <ul className="mt-1 space-y-0.5 border-l border-border pl-3">
                    {docs.map(
                      (doc) =>
                        doc && (
                          <li key={doc.slug}>
                            <Link
                              href={`/docs/${doc.slug}`}
                              className={`block py-1 text-sm ${
                                doc.slug === currentSlug
                                  ? "font-medium text-foreground"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {doc.frontmatter.title}
                            </Link>
                          </li>
                        )
                    )}
                  </ul>
                </details>
              </li>
            )
          })
        )}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 3: Article route**

`apps/dashboard/app/(app)/docs/[slug]/page.tsx`:

```tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { DocsMdx } from "@/components/docs/mdx"
import { DocsSidebar } from "@/components/docs/docs-sidebar"
import { getAdjacentDocs, getDoc } from "@/lib/docs/docs"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const doc = await getDoc(await getLocale(), slug)
  return doc
    ? { title: doc.frontmatter.title, description: doc.frontmatter.description }
    : {}
}

export default async function DocArticlePage({ params }: Props) {
  const { slug } = await params
  const locale = await getLocale()
  const doc = await getDoc(locale, slug)
  if (doc === null) notFound()
  const t = await getTranslations("dashboard.docs")
  const { previous, next } = getAdjacentDocs(slug)
  const [previousDoc, nextDoc] = await Promise.all([
    previous ? getDoc(locale, previous) : null,
    next ? getDoc(locale, next) : null,
  ])
  return (
    <div className="flex gap-10">
      <DocsSidebar locale={locale} currentSlug={slug} />
      <article className="min-w-0 max-w-3xl flex-1 pb-16">
        <h1 className="text-2xl font-semibold">{doc.frontmatter.title}</h1>
        <p className="mt-2 text-muted-foreground">
          {doc.frontmatter.description}
        </p>
        <DocsMdx body={doc.body} />
        <div className="mt-12 flex justify-between border-t border-border pt-6 text-sm">
          {previousDoc ? (
            <Link href={`/docs/${previousDoc.slug}`} className="text-brand">
              &larr; {previousDoc.frontmatter.title}
            </Link>
          ) : (
            <span />
          )}
          {nextDoc ? (
            <Link href={`/docs/${nextDoc.slug}`} className="text-brand">
              {nextDoc.frontmatter.title} &rarr;
            </Link>
          ) : (
            <span />
          )}
        </div>
      </article>
    </div>
  )
}
```

- [ ] **Step 4: Index route**

`apps/dashboard/app/(app)/docs/page.tsx`:

```tsx
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { AssistantPrompt } from "@/components/assistant/assistant-prompt"
import { getDoc } from "@/lib/docs/docs"
import { DOCS_NAV, POPULAR_DOCS, SECTION_LABEL_KEYS } from "@/lib/docs/docs-nav"

export default async function DocsIndexPage() {
  const locale = await getLocale()
  const t = await getTranslations("dashboard.docs")
  const popular = (
    await Promise.all(POPULAR_DOCS.map((slug) => getDoc(locale, slug)))
  ).filter((doc) => doc !== null)
  return (
    <div className="mx-auto max-w-4xl pb-16">
      <h1 className="text-2xl font-semibold">{t("index.title")}</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">{t("index.intro")}</p>
      <div className="mt-6 max-w-xl">
        <AssistantPrompt />
      </div>
      <h2 className="mt-12 text-lg font-semibold">{t("index.popular")}</h2>
      <ul className="mt-3 space-y-2">
        {popular.map((doc) => (
          <li key={doc.slug}>
            <Link href={`/docs/${doc.slug}`} className="text-brand hover:underline">
              {doc.frontmatter.title}
            </Link>
            <span className="ml-2 text-sm text-muted-foreground">
              {doc.frontmatter.description}
            </span>
          </li>
        ))}
      </ul>
      <h2 className="mt-12 text-lg font-semibold">{t("index.browse")}</h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {await Promise.all(
          DOCS_NAV.map(async (section) => {
            const docs = (
              await Promise.all(section.pages.map((s) => getDoc(locale, s)))
            ).filter((doc) => doc !== null)
            return (
              <section key={section.section}>
                <h3 className="text-sm font-medium">
                  {t(SECTION_LABEL_KEYS[section.section as keyof typeof SECTION_LABEL_KEYS])}
                </h3>
                <ul className="mt-2 space-y-1">
                  {docs.map((doc) => (
                    <li key={doc.slug}>
                      <Link
                        href={`/docs/${doc.slug}`}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {doc.frontmatter.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/dashboard && bun run typecheck`
Expected: clean. (No skeleton components: these pages read the filesystem, not Convex; the loading-state rule does not apply.)

### Task 2.5: App sidebar entry and i18n chrome

**Files:**
- Modify: `apps/dashboard/components/app-sidebar.tsx` (add one item to the `navStatus` array, after the Assistant item)
- Modify: `packages/i18n/messages/en.json`, `sv.json`, `nb.json`, `da.json`, `fi.json`

**Interfaces:**
- Consumes: the routes from 2.4.
- Produces: `dashboard.nav.docs` and the `dashboard.docs.*` chrome namespace used by 2.2/2.4 and every later phase.

- [ ] **Step 1: Sidebar item**

In `apps/dashboard/components/app-sidebar.tsx`, append to the `navStatus` array an item shaped EXACTLY like its neighbours (same fields; copy the Assistant item and change these values):

```ts
    {
      title: t("nav.docs"),
      url: "/docs",
      icon: BookOpen01Icon,
    },
```

Import `BookOpen01Icon` alongside the existing `@hugeicons/core-free-icons` imports. If that name is not exported there, pick the closest book/help icon the package DOES export and note it in the change summary.

- [ ] **Step 2: Message keys, en first**

In `packages/i18n/messages/en.json`: add `"docs": "Documentation"` under `dashboard.nav`, and a new `dashboard.docs` object:

```json
"docs": {
  "index": {
    "title": "Documentation",
    "intro": "Guides for everything in blueprnt, from your first onboarding to a completed pay mapping.",
    "popular": "Popular guides",
    "browse": "All guides"
  },
  "sections": {
    "gettingStarted": "Getting started",
    "model": "Evaluation model",
    "roles": "Roles",
    "evaluation": "Evaluating roles",
    "people": "People",
    "payMapping": "Pay mapping",
    "assistant": "Assistant",
    "organization": "Organization",
    "account": "Account",
    "securityPrivacy": "Security and privacy",
    "glossary": "Glossary",
    "troubleshooting": "Troubleshooting"
  }
}
```

- [ ] **Step 3: Mirror to sv/nb/da/fi**

Same structure in every other message file, translated (sv: "Dokumentation", "Kom igång", "Utvärderingsmodell", "Roller", "Utvärdera roller", "Personer", "Lönekartläggning", "Assistent", "Organisation", "Konto", "Säkerhet och integritet", "Ordlista", "Felsökning"; nb/da/fi equivalents drafted with the glossary terms from the respective locale's existing messages). Do NOT edit non-ASCII values via shell perl/sed (mojibake risk); edit the JSON directly.

- [ ] **Step 4: Run the i18n parity test**

Run: `cd packages/i18n && bun run test`
Expected: PASS (key parity across all five files).

### Task 2.6: Seed pages (3 slugs x 5 locales)

**Files:**
- Create: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/introduction.mdx`
- Create: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/evaluating-a-role.mdx`
- Create: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/importing-people.mdx`

**Interfaces:**
- Consumes: the Phase 1 dossier (`getting-started.md`, `evaluation.md`, `people.md`) as source material.
- Produces: the first real content; Phase 3 refines these pages, it does not restart them.

- [ ] **Step 1: Write `en/introduction.mdx`**

```mdx
---
title: Introduction
description: What blueprnt is and how it takes you from roles to a completed pay mapping.
section: getting-started
order: 1
---

blueprnt helps HR teams evaluate roles and run the statutory pay mapping
(lönekartläggning) required by Swedish law and the EU pay transparency
directive.

## How the pieces fit together

1. The [evaluation model](/model) defines the criteria every role is
   evaluated against.
2. [Roles](/roles) describe jobs, never people. Each role gets a job
   profile and an evaluation.
3. [People](/people) are imported with their pay and classified into
   roles.
4. A [pay mapping](/pay-mappings) freezes the current state and walks you
   through the analysis the law requires.

## Where to go next

- New organization: follow the [onboarding guide](/docs/onboarding-guide).
- Ready to evaluate: see [evaluating a role](/docs/evaluating-a-role).
- Have a payroll file: see [importing people](/docs/importing-people).
```

Note: `/docs/onboarding-guide` does not exist until Phase 3; for Phase 2 the link guard must pass, so in the SEED version replace that bullet with a link to `/docs/importing-people` and restore the onboarding link in Phase 3 Task 3.1. The other two seed pages are written the same way: frontmatter per the corpus table (`evaluating-a-role`: section `evaluation`, order 1; `importing-people`: section `people`, order 3), body from the dossier with `##` headings, links only to existing targets.

- [ ] **Step 2: Write the other two en pages** (from the dossier: `evaluating-a-role` covers the blind stepper, the 0-5 steps, the profile-complete precondition, and the score/level reveal; `importing-people` covers the four wizard steps, CSV-only intake, and the monthly/annual pay basis choice)

- [ ] **Step 3: Translate all three pages to sv, nb, da, fi** (Phase 4's translation rules apply: canonical glossary terms, exact UI label wording from that locale's messages, statutory Swedish terms kept where the locale does)

- [ ] **Step 4: Run the loader tests**

Run: `cd apps/dashboard && bun run test -- lib/docs/docs.test.ts`
Expected: PASS (including the `getDoc("en", "introduction")` case).

- [ ] **Step 5: Manual smoke test**

Run the dev server (`bun run dev` in apps/dashboard is port 3001), sign in, open `/docs` and `/docs/introduction`, switch UI language to Swedish, confirm the Swedish content renders. Restart the dev server first if nav labels show raw keys (static-import caveat in `00-overview.md`).

### Task 2.7: Drift guards 1-4

**Files:**
- Create: `apps/dashboard/test/app-routes.ts`
- Test: `apps/dashboard/lib/docs/docs-guards.test.ts`

**Interfaces:**
- Consumes: `DOCS_NAV`, `SECTION_LABEL_KEYS`, `allDocSlugs` (2.2), `docFrontmatterSchema` (2.1), `headingAnchor` (2.3), message JSON via the vitest alias, `routing` from `@workspace/i18n/routing`.
- Produces: `collectStaticAppRoutes(): Set<string>` (reused by Phase 3's prompt guard).

- [ ] **Step 1: Route inventory helper**

`apps/dashboard/test/app-routes.ts`:

```ts
import { readdirSync } from "node:fs"
import path from "node:path"

// Static app routes from the app directory: route groups unwrap, dynamic
// segments are excluded (docs and the assistant prompt never link to a
// specific entity).
export function collectStaticAppRoutes(): Set<string> {
  const appDir = new URL("../app/", import.meta.url).pathname
  const routes = new Set<string>()
  const walk = (dir: string, url: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        if (entry.name === "page.tsx") routes.add(url === "" ? "/" : url)
        continue
      }
      if (entry.name.startsWith("[")) continue
      if (entry.name.startsWith("(")) walk(path.join(dir, entry.name), url)
      else walk(path.join(dir, entry.name), `${url}/${entry.name}`)
    }
  }
  walk(appDir, "")
  return routes
}
```

- [ ] **Step 2: Write the guards**

`apps/dashboard/lib/docs/docs-guards.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import da from "@workspace/i18n/messages/da.json"
import en from "@workspace/i18n/messages/en.json"
import fi from "@workspace/i18n/messages/fi.json"
import nb from "@workspace/i18n/messages/nb.json"
import sv from "@workspace/i18n/messages/sv.json"
import { routing } from "@workspace/i18n/routing"
import { describe, expect, it } from "vitest"
import { headingAnchor } from "@/lib/docs/anchors"
import { collectStaticAppRoutes } from "@/test/app-routes"
import { allDocSlugs, DOCS_NAV, SECTION_LABEL_KEYS } from "./docs-nav"
import { docFrontmatterSchema } from "./frontmatter"
import { parseMdx } from "./parse-mdx"

const CONTENT_ROOT = new URL("../../content/docs/", import.meta.url).pathname
const MESSAGES: Record<string, unknown> = { en, sv, nb, da, fi }

const slugsOf = (locale: string) =>
  readdirSync(path.join(CONTENT_ROOT, locale))
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""))
    .sort()

const bodyOf = (locale: string, slug: string) =>
  parseMdx(readFileSync(path.join(CONTENT_ROOT, locale, `${slug}.mdx`), "utf8"))

const anchorsOf = (locale: string, slug: string) =>
  new Set(
    [...bodyOf(locale, slug).content.matchAll(/^#{2,4}\s+(.+)$/gm)].map((m) =>
      headingAnchor(m[1] ?? "")
    )
  )

describe("guard 1: locale parity", () => {
  it("every locale has exactly the en slug set", () => {
    const enSlugs = slugsOf("en")
    for (const locale of routing.locales) {
      expect(slugsOf(locale), `locale ${locale}`).toEqual(enSlugs)
    }
  })
})

describe("guard 2: frontmatter", () => {
  it("every file in every locale validates and names a nav section", () => {
    const sections = new Set(DOCS_NAV.map((s) => s.section))
    for (const locale of routing.locales) {
      for (const slug of slugsOf(locale)) {
        const { data } = bodyOf(locale, slug)
        const parsed = docFrontmatterSchema.parse(data)
        expect(sections.has(parsed.section), `${locale}/${slug}`).toBe(true)
      }
    }
  })
})

describe("guard 3: nav drift", () => {
  it("nav slugs and en files are the same set", () => {
    expect([...allDocSlugs()].sort()).toEqual(slugsOf("en"))
  })
  it("every section has a label key resolving in every locale", () => {
    for (const section of DOCS_NAV) {
      const key = SECTION_LABEL_KEYS[section.section as keyof typeof SECTION_LABEL_KEYS]
      expect(key, section.section).toBeDefined()
      const leaf = key.split(".")[1] ?? ""
      for (const locale of routing.locales) {
        const messages = MESSAGES[locale] as {
          dashboard: { docs: { sections: Record<string, string> } }
        }
        expect(
          messages.dashboard.docs.sections[leaf],
          `${locale} ${key}`
        ).toBeTruthy()
      }
    }
  })
})

describe("guard 4: internal links", () => {
  const LINK = /\]\((\/[^)#\s]*|)(#[^)\s]+)?\)/g
  it("every internal link and anchor resolves, in every locale", () => {
    const appRoutes = collectStaticAppRoutes()
    const docSlugs = new Set(allDocSlugs())
    for (const locale of routing.locales) {
      for (const slug of slugsOf(locale)) {
        for (const match of bodyOf(locale, slug).content.matchAll(LINK)) {
          const [, target = "", anchor] = match
          if (target === "" && anchor) {
            expect(anchorsOf(locale, slug).has(anchor.slice(1)), `${locale}/${slug} ${anchor}`).toBe(true)
          } else if (target.startsWith("/docs/")) {
            const targetSlug = target.slice("/docs/".length)
            expect(docSlugs.has(targetSlug), `${locale}/${slug} -> ${target}`).toBe(true)
            if (anchor) {
              expect(anchorsOf(locale, targetSlug).has(anchor.slice(1)), `${locale}/${slug} -> ${target}${anchor}`).toBe(true)
            }
          } else if (target.startsWith("/")) {
            expect(appRoutes.has(target), `${locale}/${slug} -> ${target}`).toBe(true)
          }
        }
      }
    }
  })
})
```

- [ ] **Step 3: Run to verify failure, then pass**

Run: `cd apps/dashboard && bun run test -- lib/docs/docs-guards.test.ts`
First run should FAIL only if the seed content violates a guard (fix the content, not the guard). Then: PASS.

- [ ] **Step 4: Full gate**

Run: `bun run test` (repo root, turbo) and `cd apps/dashboard && bun run lint && bun run typecheck`
Expected: all green, Biome at zero. Leave staged-ready.
