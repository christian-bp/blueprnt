import { describe, expect, it } from "vitest"
import {
  createOrgSchema,
  createUserSchema,
  orgSettingsSchema,
} from "./admin-schemas"

describe("admin-schemas", () => {
  it("createUserSchema requires a name and a valid email", () => {
    expect(
      createUserSchema.safeParse({ name: "A", email: "a@b.se" }).success
    ).toBe(true)
    expect(
      createUserSchema.safeParse({ name: "", email: "a@b.se" }).success
    ).toBe(false)
    expect(
      createUserSchema.safeParse({ name: "A", email: "nope" }).success
    ).toBe(false)
  })

  it("createOrgSchema requires a name and a slug-shaped slug", () => {
    expect(
      createOrgSchema.safeParse({ name: "Acme", slug: "acme-ab" }).success
    ).toBe(true)
    expect(
      createOrgSchema.safeParse({ name: "Acme", slug: "Acme AB" }).success
    ).toBe(false)
    expect(createOrgSchema.safeParse({ name: "", slug: "acme" }).success).toBe(
      false
    )
  })

  it("orgSettingsSchema accepts an all-optional patch", () => {
    expect(orgSettingsSchema.safeParse({}).success).toBe(true)
    expect(orgSettingsSchema.safeParse({ country: "se" }).success).toBe(true)
  })
})
