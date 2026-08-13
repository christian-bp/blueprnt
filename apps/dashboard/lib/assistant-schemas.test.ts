import { describe, expect, it } from "vitest"
import { makeRenameConversationSchema } from "@/lib/assistant-schemas"

const t = ((key: string) => key) as never

describe("makeRenameConversationSchema", () => {
  it("rejects an empty title and trims a valid one", () => {
    const schema = makeRenameConversationSchema(t)
    expect(schema.safeParse({ title: "   " }).success).toBe(false)
    const ok = schema.safeParse({ title: "  Pay gap overview  " })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.title).toBe("Pay gap overview")
  })

  it("rejects a title over 60 characters and accepts one at the bound", () => {
    const schema = makeRenameConversationSchema(t)
    expect(schema.safeParse({ title: "x".repeat(61) }).success).toBe(false)
    expect(schema.safeParse({ title: "x".repeat(60) }).success).toBe(true)
  })
})
