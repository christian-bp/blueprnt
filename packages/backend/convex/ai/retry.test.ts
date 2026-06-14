import { describe, expect, it, vi } from "vitest"

import { isSchemaMiss, withSchemaRetry } from "./retry"

function schemaMiss(name = "AI_NoObjectGeneratedError"): Error {
  const error = new Error("response did not match schema")
  error.name = name
  return error
}

describe("isSchemaMiss", () => {
  it("matches the no-object and no-output errors by name", () => {
    expect(isSchemaMiss(schemaMiss("AI_NoObjectGeneratedError"))).toBe(true)
    expect(isSchemaMiss(schemaMiss("AI_NoOutputGeneratedError"))).toBe(true)
  })

  it("does not match other errors", () => {
    expect(isSchemaMiss(new Error("network down"))).toBe(false)
    expect(isSchemaMiss(schemaMiss("AI_RetryError"))).toBe(false)
    expect(isSchemaMiss("not an error")).toBe(false)
  })
})

describe("withSchemaRetry", () => {
  it("returns the result without retrying when the first attempt succeeds", async () => {
    const generate = vi.fn().mockResolvedValue("ok")
    await expect(withSchemaRetry(generate)).resolves.toBe("ok")
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it("regenerates on a schema miss, then returns the next valid result", async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(schemaMiss())
      .mockResolvedValueOnce("ok")
    await expect(withSchemaRetry(generate)).resolves.toBe("ok")
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it("propagates a non-schema error immediately without retrying", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("model unavailable"))
    await expect(withSchemaRetry(generate)).rejects.toThrow("model unavailable")
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it("rethrows the last schema miss after exhausting the attempts", async () => {
    const generate = vi.fn().mockRejectedValue(schemaMiss())
    await expect(withSchemaRetry(generate, 3)).rejects.toThrow(
      "response did not match schema"
    )
    expect(generate).toHaveBeenCalledTimes(3)
  })
})
