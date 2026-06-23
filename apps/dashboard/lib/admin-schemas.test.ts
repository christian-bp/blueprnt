import { describe, expect, it } from "vitest"
import {
  createOrgSchema,
  createUserSchema,
  orgSettingsSchema,
} from "./admin-schemas"

describe("admin-schemas", () => {
  it("createUserSchema requires name, email, organization, and role", () => {
    const valid = {
      name: "A",
      email: "a@b.se",
      orgId: "org_1",
      role: "editor",
    }
    expect(createUserSchema.safeParse(valid).success).toBe(true)
    expect(createUserSchema.safeParse({ ...valid, name: "" }).success).toBe(
      false
    )
    expect(
      createUserSchema.safeParse({ ...valid, email: "nope" }).success
    ).toBe(false)
    expect(createUserSchema.safeParse({ ...valid, orgId: "" }).success).toBe(
      false
    )
    // Missing org and role entirely is rejected (no orgless users).
    expect(
      createUserSchema.safeParse({ name: "A", email: "a@b.se" }).success
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
