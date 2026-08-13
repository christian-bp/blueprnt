import { describe, expect, it } from "vitest"
import { ASSISTANT_STREAM_SMOOTHING_MS } from "../ai/config"
import { assistantStreamSmoothingOptions } from "./generate"

describe("assistantStreamSmoothingOptions", () => {
  it("paces text arrival word by word at the configured delay", () => {
    expect(assistantStreamSmoothingOptions()).toEqual({
      delayInMs: ASSISTANT_STREAM_SMOOTHING_MS,
      chunking: "word",
    })
  })
})
