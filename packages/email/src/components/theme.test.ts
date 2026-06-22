import { afterEach, describe, expect, it } from "vitest"
import { logoUrl } from "./theme"

const original = process.env.SITE_URL

afterEach(() => {
  if (original === undefined) delete process.env.SITE_URL
  else process.env.SITE_URL = original
})

describe("logoUrl", () => {
  it("builds the URL from SITE_URL when set", () => {
    process.env.SITE_URL = "https://app.example.test"
    expect(logoUrl()).toBe(
      "https://app.example.test/email/blueprnt-wordmark.png"
    )
  })

  it("falls back to the production origin when SITE_URL is unset", () => {
    delete process.env.SITE_URL
    expect(logoUrl()).toBe(
      "https://app.blueprnt.se/email/blueprnt-wordmark.png"
    )
  })
})
