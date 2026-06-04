import { describe, expect, it } from "vitest"
import { renderEmail } from "./render"

describe("renderEmail", () => {
  it("renders the invitation email with interpolated values", async () => {
    const result = await renderEmail("invitation", {
      inviterName: "Anna",
      workspaceName: "Acme",
      acceptUrl: "https://app.example.com/accept-invitation/inv_1",
      locale: "en",
    })
    expect(result.subject).toBe("Anna invited you to Acme on blueprnt")
    expect(result.html).toContain("accept-invitation/inv_1")
    expect(result.text).toContain("Acme")
  })

  it("renders Swedish when locale is sv", async () => {
    const result = await renderEmail("verifyEmail", {
      url: "https://x.example/verify",
      locale: "sv",
    })
    expect(result.subject).not.toBe("Verify your email address")
  })

  it("falls back to English for unknown locales", async () => {
    const result = await renderEmail("resetPassword", {
      url: "https://x.example/reset",
      locale: "xx",
    })
    expect(result.subject).toBe("Reset your password")
  })
})
