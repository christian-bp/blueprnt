import { describe, expect, it } from "vitest"
import { makeRenameFamilySchema } from "@/lib/role-schemas"

const t = ((key: string) => key) as never

describe("makeRenameFamilySchema", () => {
  it("rejects an empty name and trims a valid one", () => {
    const schema = makeRenameFamilySchema(t)
    expect(schema.safeParse({ name: "   " }).success).toBe(false)
    const ok = schema.safeParse({ name: "  Tech  " })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.name).toBe("Tech")
  })
})
