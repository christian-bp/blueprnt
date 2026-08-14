import { RAG } from "@convex-dev/rag"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { components, internal } from "../_generated/api"
import type { ActionCtx } from "../_generated/server"
import { AI_EMBEDDING_DIMENSION, AI_EMBEDDING_MODEL_ID } from "../ai/config"
import { initConvexTest } from "../testing.helpers"

type TestConvex = ReturnType<typeof initConvexTest>

// Seeding and inspection both run on the same action context the swept code
// uses, so they go through the component's own client rather than reaching
// into its tables.
const withAction = <T>(t: TestConvex, fn: (ctx: ActionCtx) => Promise<T>) =>
  t.action(fn)

// Seeding client. Identical namespace identity to the one docs/rag.ts builds
// (a namespace is keyed by model id and dimension, so a mismatch here would
// leave sweepLocale looking at a different namespace than the one seeded),
// but the model is the plain model-id string the RAG client also accepts:
// every seeded chunk carries its own embedding, so no embedding call is ever
// made and no provider is needed.
const seedRag = new RAG(components.rag, {
  textEmbeddingModel: AI_EMBEDDING_MODEL_ID,
  embeddingDimension: AI_EMBEDDING_DIMENSION,
})

// A deterministic vector per page, distinct enough that two pages never
// collapse into one point. Only its length matters to the component.
const embeddingFor = (seed: number): number[] =>
  Array.from({ length: AI_EMBEDDING_DIMENSION }, (_, index) =>
    index === seed % AI_EMBEDDING_DIMENSION ? 1 : 0
  )

type Seeded = { locale: string; slug: string; pageHash: string }

const seedPage = (t: TestConvex, { locale, slug, pageHash }: Seeded) =>
  withAction(t, async (ctx) => {
    await seedRag.add(ctx, {
      namespace: locale,
      key: slug,
      contentHash: pageHash,
      title: slug,
      metadata: { slug, pageTitle: slug },
      chunks: [
        {
          text: `${slug} body ${pageHash}`,
          metadata: { slug, pageTitle: slug, heading: null, anchor: null },
          embedding: embeddingFor(slug.length + pageHash.length),
        },
      ],
    })
  })

const entryKeys = (
  t: TestConvex,
  locale: string,
  status: "ready" | "replaced" = "ready"
) =>
  withAction(t, async (ctx) => {
    const namespace = await seedRag.getNamespace(ctx, { namespace: locale })
    if (namespace === null) return []
    const { page } = await seedRag.list(ctx, {
      namespaceId: namespace.namespaceId,
      status,
      limit: 100,
    })
    return page.map((entry) => entry.key ?? "").sort()
  })

// docs/rag.ts builds its RAG client per call from the configured provider, so
// the presence of the key is what decides whether the client exists at all.
// Set it per test rather than globally: the unconfigured path is a behaviour
// under test, not an accident.
const originalKey = process.env.MISTRAL_API_KEY

beforeEach(() => {
  process.env.MISTRAL_API_KEY = "test-key"
})

afterEach(() => {
  if (originalKey === undefined) delete process.env.MISTRAL_API_KEY
  else process.env.MISTRAL_API_KEY = originalKey
})

describe("sweepLocale", () => {
  it("retires a page that is no longer on disk and spares the ones that are", async () => {
    const t = initConvexTest()
    await seedPage(t, { locale: "en", slug: "keep", pageHash: "h1" })
    await seedPage(t, { locale: "en", slug: "also-keep", pageHash: "h2" })
    await seedPage(t, { locale: "en", slug: "retired", pageHash: "h3" })
    expect(await entryKeys(t, "en")).toEqual(["also-keep", "keep", "retired"])

    const result = await t.action(internal.docs.rag.sweepLocale, {
      locale: "en",
      keepSlugs: ["keep", "also-keep"],
    })

    expect(result).toEqual({ retired: 1, reclaimed: 0 })
    expect(await entryKeys(t, "en")).toEqual(["also-keep", "keep"])
  })

  it("leaves another locale's namespace untouched", async () => {
    const t = initConvexTest()
    await seedPage(t, { locale: "en", slug: "shared-slug", pageHash: "h1" })
    await seedPage(t, { locale: "sv", slug: "shared-slug", pageHash: "h1" })

    const result = await t.action(internal.docs.rag.sweepLocale, {
      locale: "en",
      keepSlugs: [],
    })

    expect(result).toEqual({ retired: 1, reclaimed: 0 })
    expect(await entryKeys(t, "en")).toEqual([])
    expect(await entryKeys(t, "sv")).toEqual(["shared-slug"])
  })

  it("reclaims the superseded version of a page it keeps", async () => {
    const t = initConvexTest()
    await seedPage(t, { locale: "en", slug: "keep", pageHash: "h1" })
    await seedPage(t, { locale: "en", slug: "keep", pageHash: "h2" })
    expect(await entryKeys(t, "en", "replaced")).toEqual(["keep"])

    const result = await t.action(internal.docs.rag.sweepLocale, {
      locale: "en",
      keepSlugs: ["keep"],
    })

    expect(result).toEqual({ retired: 0, reclaimed: 1 })
    // The live version survives the reclaim: it shares its key with the
    // version that was removed, so a reclaim by key would take both.
    expect(await entryKeys(t, "en")).toEqual(["keep"])
    expect(await entryKeys(t, "en", "replaced")).toEqual([])
  })

  it("counts a retired page once, never also as a reclaim", async () => {
    const t = initConvexTest()
    await seedPage(t, { locale: "en", slug: "retired", pageHash: "h1" })
    await seedPage(t, { locale: "en", slug: "retired", pageHash: "h2" })

    const result = await t.action(internal.docs.rag.sweepLocale, {
      locale: "en",
      keepSlugs: [],
    })

    expect(result).toEqual({ retired: 1, reclaimed: 0 })
    expect(await entryKeys(t, "en")).toEqual([])
    expect(await entryKeys(t, "en", "replaced")).toEqual([])
  })

  it("fails loudly when the locale has no matching namespace", async () => {
    const t = initConvexTest()
    await seedPage(t, { locale: "en", slug: "keep", pageHash: "h1" })

    await expect(
      t.action(internal.docs.rag.sweepLocale, {
        locale: "sv",
        keepSlugs: ["keep"],
      })
    ).rejects.toThrow(/documentation namespace/)
  })

  it("fails loudly when the provider is unconfigured", async () => {
    const t = initConvexTest()
    await seedPage(t, { locale: "en", slug: "keep", pageHash: "h1" })
    delete process.env.MISTRAL_API_KEY

    await expect(
      t.action(internal.docs.rag.sweepLocale, {
        locale: "en",
        keepSlugs: [],
      })
    ).rejects.toThrow(/MISTRAL_API_KEY/)
    expect(await entryKeys(t, "en")).toEqual(["keep"])
  })
})

describe("indexPage", () => {
  it("skips a page whose content hash is unchanged", async () => {
    const t = initConvexTest()
    await seedPage(t, { locale: "en", slug: "guide", pageHash: "h1" })

    // No embedding call is reachable here: the content-hash gate returns
    // before rag.add, which is the whole point of the gate. If it ever stops
    // returning early this fails on the provider call instead of passing.
    const created = await t.action(internal.docs.rag.indexPage, {
      locale: "en",
      slug: "guide",
      pageHash: "h1",
      pageTitle: "Guide",
      chunks: [
        { pageTitle: "Guide", heading: null, anchor: null, text: "body" },
      ],
    })

    expect(created).toBe(false)
    expect(await entryKeys(t, "en")).toEqual(["guide"])
  })

  it("fails loudly when the provider is unconfigured", async () => {
    const t = initConvexTest()
    delete process.env.MISTRAL_API_KEY

    await expect(
      t.action(internal.docs.rag.indexPage, {
        locale: "en",
        slug: "guide",
        pageHash: "h1",
        pageTitle: "Guide",
        chunks: [
          { pageTitle: "Guide", heading: null, anchor: null, text: "body" },
        ],
      })
    ).rejects.toThrow(/MISTRAL_API_KEY/)
  })
})

describe("searchDocs", () => {
  it("returns no hits and spends nothing when the provider is unconfigured", async () => {
    const t = initConvexTest()
    delete process.env.MISTRAL_API_KEY

    const hits = await t.action(internal.docs.rag.searchDocs, {
      orgId: "org_1",
      actorId: "user_1",
      locale: "sv",
      query: "vad ar lika arbete",
    })

    expect(hits).toEqual([])
    const usage = await t.run((ctx) => ctx.db.query("aiUsageEvents").collect())
    expect(usage).toEqual([])
  })
})
