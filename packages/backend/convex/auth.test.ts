import { describe, expect, it } from "vitest"
import { CHANGE_EMAIL_DONE_CALLBACK, rewriteChangeEmailCallback } from "./auth"

// The change-email senders themselves are session-gated Better Auth callbacks
// that convex-test cannot drive (see the carve-out comment in auth.ts); they
// are covered by the e2e/Playwright suite. The one piece we can isolate is the
// pure callbackURL rewrite that hop 2 applies, tested directly here.
describe("rewriteChangeEmailCallback", () => {
  it("rewrites the hop-1 callbackURL to the hop-2 done page", () => {
    const input =
      "https://app.blueprnt.se/api/auth/verify-email" +
      "?token=abc123&callbackURL=" +
      encodeURIComponent("/change-email?step=confirmed")
    const out = new URL(rewriteChangeEmailCallback(input))
    expect(out.searchParams.get("callbackURL")).toBe(CHANGE_EMAIL_DONE_CALLBACK)
  })

  it("preserves the Better Auth token and other outer params", () => {
    const input =
      "https://app.blueprnt.se/api/auth/verify-email" +
      "?token=tok-xyz&extra=keep&callbackURL=" +
      encodeURIComponent("/change-email?step=confirmed&nested=1")
    const out = new URL(rewriteChangeEmailCallback(input))
    expect(out.searchParams.get("token")).toBe("tok-xyz")
    expect(out.searchParams.get("extra")).toBe("keep")
    expect(out.searchParams.get("callbackURL")).toBe(CHANGE_EMAIL_DONE_CALLBACK)
    // The endpoint path is untouched.
    expect(out.pathname).toBe("/api/auth/verify-email")
  })

  it("preserves the order/identity of unrelated params (only callbackURL changes)", () => {
    const input =
      "https://app.blueprnt.se/api/auth/verify-email" +
      "?token=t1&callbackURL=" +
      encodeURIComponent("/change-email?step=confirmed") +
      "&aud=email-verification"
    const out = new URL(rewriteChangeEmailCallback(input))
    expect(out.searchParams.get("token")).toBe("t1")
    expect(out.searchParams.get("aud")).toBe("email-verification")
    expect(out.searchParams.get("callbackURL")).toBe(CHANGE_EMAIL_DONE_CALLBACK)
  })

  it("adds a callbackURL when the input has none", () => {
    const input = "https://app.blueprnt.se/api/auth/verify-email?token=only"
    const out = new URL(rewriteChangeEmailCallback(input))
    expect(out.searchParams.get("token")).toBe("only")
    expect(out.searchParams.get("callbackURL")).toBe(CHANGE_EMAIL_DONE_CALLBACK)
  })

  it("handles a url with no query params at all", () => {
    const input = "https://app.blueprnt.se/api/auth/verify-email"
    const out = new URL(rewriteChangeEmailCallback(input))
    expect(out.pathname).toBe("/api/auth/verify-email")
    expect(out.searchParams.get("callbackURL")).toBe(CHANGE_EMAIL_DONE_CALLBACK)
  })

  it("keeps a relative input relative (path + rewritten query)", () => {
    const input =
      "/api/auth/verify-email?token=rel&callbackURL=" +
      encodeURIComponent("/change-email?step=confirmed")
    const out = rewriteChangeEmailCallback(input)
    // No scheme/host leaked from the throwaway parse base.
    expect(out.startsWith("/api/auth/verify-email")).toBe(true)
    expect(out).not.toContain("placeholder.invalid")
    const parsed = new URL(out, "https://example.test")
    expect(parsed.searchParams.get("token")).toBe("rel")
    expect(parsed.searchParams.get("callbackURL")).toBe(
      CHANGE_EMAIL_DONE_CALLBACK
    )
  })

  it("overwrites an existing done callbackURL idempotently", () => {
    const input =
      "https://app.blueprnt.se/api/auth/verify-email?token=t&callbackURL=" +
      encodeURIComponent(CHANGE_EMAIL_DONE_CALLBACK)
    const once = rewriteChangeEmailCallback(input)
    const twice = rewriteChangeEmailCallback(once)
    expect(twice).toBe(once)
    expect(new URL(twice).searchParams.get("callbackURL")).toBe(
      CHANGE_EMAIL_DONE_CALLBACK
    )
  })
})
