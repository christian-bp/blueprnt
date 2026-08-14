"use node"

import type { Entry, NamespaceId, Status } from "@convex-dev/rag"
import { RAG } from "@convex-dev/rag"
import { v } from "convex/values"
import { components, internal } from "../_generated/api"
import type { ActionCtx } from "../_generated/server"
import { internalAction } from "../_generated/server"
import {
  AI_DOCS_SCORE_THRESHOLD,
  AI_EMBEDDING_DIMENSION,
  AI_EMBEDDING_MODEL_ID,
  AI_PROVIDER,
} from "../ai/config"
import { aiEmbeddingModel } from "../ai/provider"
import { docsHitValidator, hitsFrom } from "./hits"

// Semantic search over the documentation corpus (ADR-0020). The locale is
// the namespace rather than a filter: a namespace is bound to one model and
// embedding dimension, and the locales are never searched together, so the
// isolation is exactly right and the English fallback is simply a second
// search in another namespace.
//
// Built per call, not at module scope, so a deployment without an API key
// degrades to "no documentation search" instead of failing to load.
function docsRag() {
  const model = aiEmbeddingModel()
  if (model === null) return null
  return new RAG(components.rag, {
    textEmbeddingModel: model,
    embeddingDimension: AI_EMBEDDING_DIMENSION,
  })
}

const SEARCH_LIMIT = 5

// One listing page of entries. The sweep reads the whole namespace, so this
// only decides how many round trips that takes.
const LIST_PAGE_SIZE = 100

// One entry per page, keyed by slug so a re-index replaces it in place, with
// the page hash as the content hash so an unchanged page costs no embedding
// call. The slug and anchor ride on each CHUNK's metadata, not the entry's,
// because the anchor is what turns a hit into a deep link and it differs per
// section of the same page.
export const indexPage = internalAction({
  args: {
    locale: v.string(),
    slug: v.string(),
    pageHash: v.string(),
    pageTitle: v.string(),
    // The chunker's own DocChunk shape (lib/docs/chunk.ts), passed through
    // verbatim so the script never has to reshape what it produces.
    chunks: v.array(
      v.object({
        pageTitle: v.string(),
        heading: v.union(v.string(), v.null()),
        anchor: v.union(v.string(), v.null()),
        text: v.string(),
      })
    ),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const rag = docsRag()
    if (rag === null) {
      throw new Error("documentation indexing needs MISTRAL_API_KEY")
    }
    // The content hash must be checked HERE, not left to rag.add: add embeds
    // the chunks before it compares hashes whenever a page has fewer than
    // CHUNK_BATCH_SIZE (100) of them, which every page in this corpus does
    // (the largest has 35). Without this gate an unchanged page is embedded
    // and paid for on every sync, and the whole corpus is re-embedded on a
    // run that changes one file.
    const existing = await rag.findEntryByContentHash(ctx, {
      namespace: args.locale,
      key: args.slug,
      contentHash: args.pageHash,
    })
    if (existing !== null && existing.status === "ready") return false
    const { created } = await rag.add(ctx, {
      namespace: args.locale,
      key: args.slug,
      contentHash: args.pageHash,
      title: args.pageTitle,
      metadata: { slug: args.slug, pageTitle: args.pageTitle },
      chunks: args.chunks.map((chunk) => ({
        text: chunk.text,
        metadata: {
          slug: args.slug,
          pageTitle: args.pageTitle,
          heading: chunk.heading,
          anchor: chunk.anchor,
        },
      })),
    })
    return created
  },
})

// Every entry of one status in a namespace, collected before anything is
// deleted. Paginated to the end rather than capped at a big limit: a limit
// that is merely "large enough today" turns into silently sweeping nothing
// the day the corpus outgrows it, and a listing whose isDone is discarded
// cannot tell the difference. Collect-then-delete keeps the cursor walk off
// a table that is being mutated underneath it.
async function listEntries(
  ctx: ActionCtx,
  rag: RAG,
  namespaceId: NamespaceId,
  status: Status
): Promise<Entry[]> {
  const entries: Entry[] = []
  let cursor: string | null = null
  for (;;) {
    const result = await rag.list(ctx, {
      namespaceId,
      status,
      paginationOpts: { cursor, numItems: LIST_PAGE_SIZE },
    })
    entries.push(...result.page)
    if (result.isDone) break
    cursor = result.continueCursor
  }
  return entries
}

// Removes any page that no longer exists on disk, the same guarantee the
// table-backed sync gave: a retired slug must not keep answering searches.
// It also reclaims the superseded VERSION of every page it keeps. rag.add
// writes a new entry and flips the previous one to "replaced" whenever the
// content hash changes, and nothing in the component ever collects those, so
// their chunks and embedding vectors would sit in the database forever and a
// CHUNKER_VERSION bump would permanently double the stored corpus.
//
// The reclaim lives here rather than in a rag.defineOnComplete hook because
// that hook is a MUTATION and this file is "use node", which may only export
// actions. It cannot key off rag.add's replacedEntry either: every page in
// this corpus stays under the component's 100-chunk batch threshold, so add
// takes its single-mutation branch and returns replacedEntry: null.
export const sweepLocale = internalAction({
  args: { locale: v.string(), keepSlugs: v.array(v.string()) },
  returns: v.object({ retired: v.number(), reclaimed: v.number() }),
  handler: async (ctx, args) => {
    const rag = docsRag()
    // Consistent with indexPage: "I could not check" must never be reported
    // as "there was nothing to remove".
    if (rag === null) {
      throw new Error("documentation sweep needs MISTRAL_API_KEY")
    }
    // A missing namespace is not an empty locale. The lookup matches on the
    // embedding model id and dimension, so a changed MISTRAL_EMBED_MODEL or
    // AI_EMBEDDING_DIMENSION returns null here even for a fully indexed
    // locale. That same mismatch makes searchDocs return no results for
    // every query, so it has to stop the sync loudly instead of passing for
    // a clean sweep of zero.
    const namespace = await rag.getNamespace(ctx, { namespace: args.locale })
    if (namespace === null) {
      throw new Error(
        `no "${args.locale}" documentation namespace for ${AI_EMBEDDING_MODEL_ID} at ${AI_EMBEDDING_DIMENSION} dimensions`
      )
    }
    const keep = new Set(args.keepSlugs)
    let retired = 0
    const live = await listEntries(ctx, rag, namespace.namespaceId, "ready")
    for (const entry of live) {
      if (entry.key === undefined || keep.has(entry.key)) continue
      // deleteByKey removes every version of the key whatever its status, so
      // a retired slug leaves nothing for the reclaim pass below. It is not
      // given a beforeVersion: the client type accepts one but the
      // component's deleteByKeySync action does not declare it, so passing
      // it fails argument validation at runtime.
      await rag.deleteByKey(ctx, {
        namespaceId: namespace.namespaceId,
        key: entry.key,
      })
      retired += 1
    }
    // After the retire pass, so the two counts can never cover the same
    // entry. Removed one entry at a time and never by key: the key's current
    // "ready" version shares that key, and deleteByKey ignores status.
    const replaced = await listEntries(
      ctx,
      rag,
      namespace.namespaceId,
      "replaced"
    )
    for (const entry of replaced) {
      await rag.delete(ctx, { entryId: entry.entryId })
    }
    return { retired, reclaimed: replaced.length }
  },
})

// Calibration surface for `bun run docs:eval`. Returns the raw score with
// each hit so a threshold sweep can be simulated offline from one run per
// query instead of paying for an embedding per candidate value, and takes
// the retrieval knobs as arguments so a configuration can be measured before
// it becomes the default. No usage row: this is offline calibration by a
// developer, the same category as the corpus indexing above, not spend on
// behalf of an organization.
export const evalSearch = internalAction({
  args: {
    locale: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
    searchType: v.optional(
      v.union(v.literal("vector"), v.literal("text"), v.literal("hybrid"))
    ),
    vectorScoreThreshold: v.optional(v.number()),
  },
  returns: v.array(
    v.object({ path: v.string(), pageTitle: v.string(), score: v.number() })
  ),
  handler: async (ctx, args) => {
    const rag = docsRag()
    if (rag === null)
      throw new Error("documentation eval needs MISTRAL_API_KEY")
    const { results } = await rag.search(ctx, {
      namespace: args.locale,
      query: args.query,
      limit: args.limit ?? SEARCH_LIMIT,
      ...(args.searchType !== undefined ? { searchType: args.searchType } : {}),
      ...(args.vectorScoreThreshold !== undefined
        ? { vectorScoreThreshold: args.vectorScoreThreshold }
        : {}),
    })
    return results.map((result, index) => {
      const hit = hitsFrom([result], false)[0]
      return {
        path: hit?.path ?? "",
        pageTitle: hit?.pageTitle ?? "",
        // The component's own score. Cosine similarity under "vector";
        // under "hybrid" it is a position-derived fusion rank, which is why
        // the two are never thresholded on the same scale.
        score: result.score ?? index,
      }
    })
  },
})

export const searchDocs = internalAction({
  args: {
    orgId: v.string(),
    actorId: v.string(),
    locale: v.string(),
    query: v.string(),
  },
  returns: v.array(docsHitValidator),
  handler: async (ctx, args) => {
    const rag = docsRag()
    if (rag === null) return []
    let spentTokens = 0
    const run = async (locale: string) => {
      const { results, usage } = await rag.search(ctx, {
        namespace: locale,
        query: args.query,
        limit: SEARCH_LIMIT,
        vectorScoreThreshold: AI_DOCS_SCORE_THRESHOLD,
      })
      spentTokens += usage.tokens ?? 0
      return results
    }
    let results = await run(args.locale)
    let isFallback = false
    // Not "this locale had no good hit": with AI_DOCS_SCORE_THRESHOLD set,
    // an empty result also covers a locale that matched pages which the
    // floor then trimmed. The English pass applies the same floor, so the
    // fallback can equally come back empty.
    if (results.length === 0 && args.locale !== "en") {
      results = await run("en")
      isFallback = true
    }
    // Embedding the query is a model call spending the org's tokens, so it
    // carries a usage row like every other call (the corpus side is indexed
    // offline by the sync script and belongs to no org).
    // Best-effort, like every other usage call site: the tokens are already
    // spent and the results are already retrieved, so a failure to record
    // must not throw away a search the user is waiting on.
    if (spentTokens > 0) {
      try {
        await ctx.runMutation(internal.ai.usage.recordAiUsageDirect, {
          orgId: args.orgId,
          kind: "assistant.docsSearch",
          provider: AI_PROVIDER,
          model: AI_EMBEDDING_MODEL_ID,
          actorId: args.actorId,
          inputTokens: spentTokens,
          outputTokens: 0,
          totalTokens: spentTokens,
          cachedInputTokens: 0,
        })
      } catch (error) {
        console.error("docs search usage recording failed", {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return hitsFrom(results, isFallback)
  },
})
