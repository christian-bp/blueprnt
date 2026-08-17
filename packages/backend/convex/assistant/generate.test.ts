import { describe, expect, it } from "vitest"
import {
  ASSISTANT_MAX_TOOL_STEPS,
  ASSISTANT_STREAM_SMOOTHING_MS,
} from "../ai/config"
import {
  assistantChartAlreadyShown,
  assistantPrepareStepToolChoice,
  assistantStreamSmoothingOptions,
} from "./generate"
import type { AssistantMessagePart } from "./tables"

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

// A chart tool both displays the chart and returns its numbers, so a model
// that calls the same one twice would append a second identical card and the
// reader would see the same plot twice in one reply. The prompt and the tool
// descriptions ask for one call; this is the guard for when they are ignored.
describe("assistantChartAlreadyShown", () => {
  const headcount: AssistantMessagePart = {
    type: "chart",
    chart: "headcountTrend",
    summary: "down from 120 to 95",
  }
  const text: AssistantMessagePart = { type: "text", text: "Headcount is down" }

  it("reports a chart kind already appended to this answer", () => {
    expect(
      assistantChartAlreadyShown([text, headcount], "headcountTrend")
    ).toBe(true)
  })

  it("lets a DIFFERENT chart through in the same answer", () => {
    expect(assistantChartAlreadyShown([headcount], "payGapTrend")).toBe(false)
  })

  it("reports nothing shown for an answer with no chart parts", () => {
    expect(assistantChartAlreadyShown([text], "headcountTrend")).toBe(false)
    expect(assistantChartAlreadyShown([], "headcountTrend")).toBe(false)
  })
})
