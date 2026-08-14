import { describe, expect, it } from "vitest"
import { assistantSystemPrompt } from "./knowledge"

describe("assistantSystemPrompt", () => {
  it("instructs the model to answer in the requested language", () => {
    expect(assistantSystemPrompt({ locale: "sv" })).toContain("Swedish")
  })

  it("falls back to English for an unknown locale", () => {
    expect(assistantSystemPrompt({ locale: "xx" })).toContain("English")
  })

  // Both rules are asserted as their operative sentence, not as a keyword:
  // this prompt is the only thing standing between salary, birth date, and
  // contact details typed by the user and the model, and a rewrite that keeps
  // the words while softening the imperative ("try to avoid personal data
  // where possible") has to fail here.
  it("carries the no-personal-data rule and the tool grounding rule", () => {
    const prompt = assistantSystemPrompt({ locale: "en" })
    expect(prompt).toContain("Never ask for, repeat, or process personal data")
    expect(prompt).toContain("ask them to remove it and continue without it")
    expect(prompt).toContain(
      "Any number you state about the organization must come from tool results; never estimate or invent one"
    )
  })

  // A live browser test showed the model summarizing the erasure page's
  // "identity is pseudonymized in the frozen snapshot while the aggregates
  // are kept" down to "the frozen data stays unchanged", which drops the
  // pseudonymization on a claim users read as compliance guidance.
  it("requires legal and compliance claims to keep the documentation's qualifiers", () => {
    const prompt = assistantSystemPrompt({ locale: "en" })
    expect(prompt).toContain("compliance guidance")
    expect(prompt).toContain("state what the documentation states and no less")
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
    // Asserted on the company line itself, not on the bare word "industry":
    // the Pages list legitimately describes the organization-settings page's
    // fields, so a word-level check fails on unrelated prompt edits while
    // still not proving the context line is absent.
    expect(assistantSystemPrompt({ locale: "en" })).not.toContain(
      "The user's company"
    )
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

  it("lists the docs page and teaches the docs search rule", () => {
    const prompt = assistantSystemPrompt({ locale: "en" })
    expect(prompt).toContain("(/docs)")
    expect(prompt).toContain("search_docs")
    expect(prompt).toContain("documentation does not cover it yet")
  })

  // Reproduced live: asked in Swedish what the difference between level and
  // seniority is, the model answered from the Core concepts without searching
  // and closed with [Roller och personer](/docs/roller-och-personer), a
  // translated slug that does not exist. Guide slugs are locale-invariant.
  it("allows only a searched documentation path and forbids translating one", () => {
    const prompt = assistantSystemPrompt({ locale: "en" })
    expect(prompt).toContain(
      "Documentation paths are the same in every language and are never translated"
    )
    expect(prompt).toContain("copying it whole including its #anchor")
    expect(prompt).toContain(
      "Without such a result, link the documentation index (/docs) instead"
    )
    expect(prompt).toContain(
      "the only guide path you may link is one that came back from search_docs"
    )
  })

  // Reproduced live: asked how to set up two-factor login, the model gave a
  // correct procedure and then sent the user to "Kontosäkerhet under
  // Organization", linking /organization, because the account pages were
  // missing from the Pages list and the rule forbids linking outside it.
  it("lists the account pages so personal settings are not misrouted to the organization page", () => {
    const prompt = assistantSystemPrompt({ locale: "en" })
    expect(prompt).toContain("(/account/profile)")
    expect(prompt).toContain("(/account/security)")
  })

  // Measured with `bun run docs:eval`: the search returns its five nearest
  // chunks for ANY query, and no cosine floor separates in-scope from
  // off-topic in Swedish without gutting recall. Asking the assistant about
  // tomorrow's weather returned five real documentation excerpts with live
  // deep links, so the model must be told the results can be irrelevant.
  it("warns that the search always returns its closest matches, relevant or not", () => {
    const prompt = assistantSystemPrompt({ locale: "en" })
    expect(prompt).toContain(
      "returns its closest matches even when the documentation does not cover the question"
    )
    expect(prompt).toContain("a weak match is not an answer")
  })

  it("requires a documentation search before a concept answer, not merely on demand", () => {
    expect(assistantSystemPrompt({ locale: "en" })).toContain(
      "Call it before you answer any question about how to use the product"
    )
  })

  it("forbids volunteering a neighbouring feature the search did not return", () => {
    const prompt = assistantSystemPrompt({ locale: "en" })
    expect(prompt).toContain(
      "Never volunteer a neighbouring feature or workflow the search did not return"
    )
    expect(prompt).toContain(
      "if the answer is that something is not supported, say that and stop"
    )
  })

  it("states seniority belongs to the person and never affects role evaluation, without claiming it does not exist in V1", () => {
    const prompt = assistantSystemPrompt({ locale: "en" })
    expect(prompt).toContain(
      "an individual's seniority within a track, set on the person"
    )
    expect(prompt).toContain(
      "It never affects a role's evaluation, weighting or level"
    )
    expect(prompt).not.toContain("Not part of V1 role evaluation")
  })

  it("instructs the model to search before answering a concept question and never to invent product specifics", () => {
    const prompt = assistantSystemPrompt({ locale: "en" })
    // Deliberately a preference, not an absolute: an earlier, stricter
    // wording ("never a source to answer from while the tool is available")
    // measurably increased tool-call failures against the provider, so the
    // rule steers toward the docs without forbidding the Core concepts.
    expect(prompt).toContain("prefer its results over the Core concepts above")
    expect(prompt).toContain(
      "Answer only from the results and never invent a specific, such as an example value, field name, label, or threshold, that they do not contain"
    )
  })

  it("bounds the never-invent rule to the search-success branch, not the empty-results fallback", () => {
    // Regression for a wording bug: the never-invent sentence used to trail
    // the "answer from the Core concepts" fallback, reading as if it also
    // forbade every Core-concepts-sourced specific in the empty-results
    // branch it immediately followed. It must now read the never-invent rule
    // before the fallback instruction, so it is unambiguously scoped to the
    // search-results case.
    const prompt = assistantSystemPrompt({ locale: "en" })
    const neverInventIndex = prompt.indexOf("never invent a specific")
    const fallbackIndex = prompt.indexOf(
      "If the search returns nothing relevant"
    )
    expect(neverInventIndex).toBeGreaterThan(-1)
    expect(fallbackIndex).toBeGreaterThan(-1)
    expect(neverInventIndex).toBeLessThan(fallbackIndex)
  })
})
