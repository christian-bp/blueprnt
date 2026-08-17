import messages from "@workspace/i18n/messages/en.json"
import { describe, expect, it } from "vitest"
import {
  ASSISTANT_SUGGESTION_POOL,
  DOCS_SUGGESTION_POOL,
  sampleSuggestions,
  type SuggestionPool,
} from "./assistant-suggestions"

const POOLS: SuggestionPool[] = [
  ASSISTANT_SUGGESTION_POOL,
  DOCS_SUGGESTION_POOL,
]

describe("sampleSuggestions", () => {
  it("draws one key from every group, in group order", () => {
    expect(sampleSuggestions(ASSISTANT_SUGGESTION_POOL, () => 0)).toEqual(
      ASSISTANT_SUGGESTION_POOL.map((group) => group[0])
    )
  })

  it("reaches the last key of a group at the top of the random range", () => {
    // Math.floor(0.999 * length) is the last index: a draw that could never
    // reach it would quietly retire half the pool.
    expect(sampleSuggestions(ASSISTANT_SUGGESTION_POOL, () => 0.999)).toEqual(
      ASSISTANT_SUGGESTION_POOL.map((group) => group[group.length - 1])
    )
  })

  // The row's whole contract: whatever the draw, the reader is offered one
  // question per capability family, never three of a kind.
  it("always covers every group exactly once, over many draws", () => {
    for (const pool of POOLS) {
      for (let draw = 0; draw < 50; draw += 1) {
        const drawn = sampleSuggestions(pool)
        expect(drawn).toHaveLength(pool.length)
        drawn.forEach((key, index) => {
          expect(pool[index]).toContain(key)
        })
      }
    }
  })

  // A pool key is a translation key: a typo would render a raw key into a
  // button, and only a chip that happened to be drawn would show it.
  it("only holds keys that exist under dashboard.assistant", () => {
    for (const pool of POOLS) {
      for (const group of pool) {
        for (const key of group) {
          expect(typeof messages.dashboard.assistant[key]).toBe("string")
        }
      }
    }
  })
})
