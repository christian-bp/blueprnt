import { describe, expect, it } from "vitest"
import type { ActionCtx } from "../_generated/server"
import { buildAssistantTools } from "./tools"

describe("buildAssistantTools", () => {
  it("builds exactly the five known tools, including search_docs", () => {
    // buildAssistantTools only builds tool DEFINITIONS: the execute closures
    // capture ctx but are never invoked here, so an empty stand-in ctx is
    // enough (no generation harness or real ActionCtx needed), mirroring how
    // generate.test.ts unit-tests assistantStreamSmoothingOptions directly
    // out of this same "use node" file's sibling, generate.ts.
    const ctx = {} as ActionCtx
    const tools = buildAssistantTools(ctx, {
      orgId: "o",
      locale: "sv",
      userId: "u",
    })
    // The full expected set, not just search_docs: this fails if any
    // existing tool is accidentally removed or renamed too, not only if
    // search_docs regresses.
    expect(Object.keys(tools).sort()).toEqual(
      [
        "get_org_stats",
        "get_pay_stats",
        "search_docs",
        "show_headcount_trend",
        "show_pay_gap_trend",
      ].sort()
    )
  })

  // The short-circuit is justified on cost grounds (an embedding call per
  // search), so it has to actually fire: a ctx whose runAction throws proves
  // the empty query never reaches the backend.
  it("answers an empty query without calling the search action", async () => {
    const ctx = {
      runAction: () => {
        throw new Error("search_docs must not run for an empty query")
      },
    } as unknown as ActionCtx
    const tools = buildAssistantTools(ctx, {
      orgId: "o",
      locale: "sv",
      userId: "u",
    })
    const execute = tools.search_docs.execute
    if (execute === undefined) throw new Error("search_docs has no execute")
    await expect(
      execute(
        { query: "   " },
        // The SDK's execution options carry a generic Context this tool never
        // reads; only the query argument matters to the assertion.
        { toolCallId: "t", messages: [] } as unknown as Parameters<
          typeof execute
        >[1]
      )
    ).resolves.toEqual([])
  })
})
