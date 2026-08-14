import { describe, expect, it } from "vitest"
import {
  ASSISTANT_MAX_TOOL_STEPS,
  ASSISTANT_STREAM_SMOOTHING_MS,
} from "../ai/config"
import {
  assistantPrepareStepToolChoice,
  assistantStreamSmoothingOptions,
} from "./generate"

describe("assistantStreamSmoothingOptions", () => {
  it("paces text arrival word by word at the configured delay", () => {
    expect(assistantStreamSmoothingOptions()).toEqual({
      delayInMs: ASSISTANT_STREAM_SMOOTHING_MS,
      chunking: "word",
    })
  })
})

describe("assistantPrepareStepToolChoice", () => {
  it("leaves tool choice untouched on an early step", () => {
    expect(assistantPrepareStepToolChoice(0)).toBeUndefined()
    expect(
      assistantPrepareStepToolChoice(ASSISTANT_MAX_TOOL_STEPS - 2)
    ).toBeUndefined()
  })

  it("forces a prose answer on the final allowed step", () => {
    expect(
      assistantPrepareStepToolChoice(ASSISTANT_MAX_TOOL_STEPS - 1)
    ).toEqual({ toolChoice: "none" })
  })
})
