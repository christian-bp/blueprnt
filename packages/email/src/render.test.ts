import { describe, expect, it } from "vitest"
import { EMAIL_LOCALES } from "./messages"
import { renderEmail } from "./render"

describe("renderEmail", () => {
  it("renders the invitation email with interpolated values", async () => {
    const result = await renderEmail("invitation", {
      inviterName: "Anna",
      organizationName: "Acme",
      acceptUrl: "https://app.example.com/accept-invitation/inv_1",
      locale: "en",
    })
    expect(result.subject).toBe("Anna invited you to Acme on blueprnt")
    expect(result.html).toContain("accept-invitation/inv_1")
    expect(result.text).toContain("Acme")
  })

  it("renders Swedish when locale is sv", async () => {
    const result = await renderEmail("resetPassword", {
      url: "https://x.example/reset",
      locale: "sv",
    })
    expect(result.subject).not.toBe("Reset your password")
  })

  it("falls back to English for unknown locales", async () => {
    const result = await renderEmail("resetPassword", {
      url: "https://x.example/reset",
      locale: "xx",
    })
    expect(result.subject).toBe("Reset your password")
    expect(result.text).not.toContain("<")
  })

  it("every EMAIL_LOCALES entry has its own translations (no silent fallback)", async () => {
    const subjects = await Promise.all(
      EMAIL_LOCALES.map(async (locale) => {
        const result = await renderEmail("resetPassword", {
          url: "https://x.example/reset",
          locale,
        })
        return result.subject
      })
    )
    expect(new Set(subjects).size).toBe(EMAIL_LOCALES.length)
  })

  it("renders the welcome email with the set-password link", async () => {
    const result = await renderEmail("welcome", {
      url: "https://x.example/reset?token=t",
      locale: "en",
    })
    expect(result.subject).toBe("Welcome to blueprnt")
    expect(result.html).toContain("https://x.example/reset?token=t")
    expect(result.html).toContain("Set your password")
  })

  it("renders the branded layout for the reset email", async () => {
    const result = await renderEmail("resetPassword", {
      url: "https://x.example/reset",
      locale: "en",
    })
    expect(result.html).toContain("/email/blueprnt-wordmark.png")
    expect(result.html).toContain('alt="blueprnt"')
    expect(result.html.toLowerCase()).toContain("#eb3e5d")
    expect(result.html).toContain("https://x.example/reset")
    expect(result.html).toContain("you can safely ignore")
    expect(result.html).toContain(`${new Date().getFullYear()} blueprnt`)
    expect(result.html).toContain(String(new Date().getFullYear()))
  })

  it("includes the CTA href and security note for the invitation email", async () => {
    const invite = await renderEmail("invitation", {
      inviterName: "Anna",
      organizationName: "Acme",
      acceptUrl: "https://x.example/accept-invitation/inv_1",
      locale: "en",
    })
    expect(invite.html).toContain("accept-invitation/inv_1")
    expect(invite.html).toContain("expecting this invitation")
    expect(invite.html).toMatch(/#eb3e5d[^>]*>\s*Acme/)
  })

  it("renders the two-factor code email with the code and branded layout", async () => {
    const result = await renderEmail("twoFactorCode", {
      code: "123456",
      email: "user@example.com",
      locale: "en",
    })
    expect(result.subject).toBe("Your blueprnt verification code")
    expect(result.html).toContain("123456")
    expect(result.html).toContain("/email/blueprnt-wordmark.png")
    expect(result.text).toContain("123456")
  })

  it("renders the two-factor code email in Swedish", async () => {
    const result = await renderEmail("twoFactorCode", {
      code: "654321",
      email: "user@example.com",
      locale: "sv",
    })
    expect(result.subject).not.toBe("Your blueprnt verification code")
    expect(result.html).toContain("654321")
  })

  it("every EMAIL_LOCALES entry has its own twoFactorCode subject (no silent fallback)", async () => {
    const subjects = await Promise.all(
      EMAIL_LOCALES.map(async (locale) => {
        const result = await renderEmail("twoFactorCode", {
          code: "123456",
          email: "user@example.com",
          locale,
        })
        return result.subject
      })
    )
    expect(new Set(subjects).size).toBe(EMAIL_LOCALES.length)
  })
})
