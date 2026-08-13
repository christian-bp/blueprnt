import { describe, expect, it } from "vitest"
import { assistantSystemPrompt } from "./knowledge"

describe("assistantSystemPrompt", () => {
  it("instructs the model to answer in the requested language", () => {
    expect(assistantSystemPrompt({ locale: "sv" })).toContain("Swedish")
  })

  it("falls back to English for an unknown locale", () => {
    expect(assistantSystemPrompt({ locale: "xx" })).toContain("English")
  })

  it("carries the no-personal-data rule and the tool grounding rule", () => {
    const prompt = assistantSystemPrompt({ locale: "en" })
    expect(prompt).toContain("personal data")
    expect(prompt).toContain("tool results")
  })

  it("instructs the model never to include images", () => {
    const prompt = assistantSystemPrompt({ locale: "en" })
    expect(prompt).toContain(
      "Never include images or image links in your answers"
    )
  })

  it("includes company context only when provided", () => {
    const withContext = assistantSystemPrompt({
      locale: "en",
      industry: "tech",
      country: "SE",
      employeeCount: 120,
    })
    expect(withContext).toContain('industry "tech"')
    expect(withContext).toContain("about 120 employees")
    expect(assistantSystemPrompt({ locale: "en" })).not.toContain("industry")
  })

  it("teaches the level vs seniority boundary", () => {
    expect(assistantSystemPrompt({ locale: "en" })).toContain(
      "Level 1 is the highest"
    )
  })

  it("instructs the model to link pages instead of only naming them", () => {
    const prompt = assistantSystemPrompt({ locale: "en" })
    expect(prompt).toContain(
      "write its name as a markdown link to the page's path"
    )
    expect(prompt).toContain("never link to anything outside this list")
    expect(prompt).toContain("/roles")
    expect(prompt).toContain("/model")
  })
})
