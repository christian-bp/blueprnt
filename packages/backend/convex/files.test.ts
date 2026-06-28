import { describe, expect, it } from "vitest"
import { api } from "./_generated/api"
import { IMAGE_UPLOAD_MAX_BYTES, isAllowedImageBlob } from "./files"
import { initConvexTest } from "./testing.helpers"

describe("isAllowedImageBlob", () => {
  it("rejects null metadata", () => {
    expect(isAllowedImageBlob(null, IMAGE_UPLOAD_MAX_BYTES)).toBe(false)
  })
  it("rejects oversized blobs", () => {
    expect(
      isAllowedImageBlob(
        { size: IMAGE_UPLOAD_MAX_BYTES + 1, contentType: "image/png" },
        IMAGE_UPLOAD_MAX_BYTES
      )
    ).toBe(false)
  })
  it("rejects non-image content types", () => {
    expect(
      isAllowedImageBlob(
        { size: 10, contentType: "application/pdf" },
        IMAGE_UPLOAD_MAX_BYTES
      )
    ).toBe(false)
  })
  it("accepts an image within the cap", () => {
    expect(
      isAllowedImageBlob(
        { size: 10, contentType: "image/jpeg" },
        IMAGE_UPLOAD_MAX_BYTES
      )
    ).toBe(true)
  })
  it("accepts a null/empty content type within the cap (size cap is the gate)", () => {
    expect(
      isAllowedImageBlob(
        { size: 10, contentType: null },
        IMAGE_UPLOAD_MAX_BYTES
      )
    ).toBe(true)
    expect(
      isAllowedImageBlob({ size: 10, contentType: "" }, IMAGE_UPLOAD_MAX_BYTES)
    ).toBe(true)
  })
})

describe("generateImageUploadUrl", () => {
  it("returns an upload URL for an authed caller", async () => {
    const t = initConvexTest()
    const url = await t
      .withIdentity({ subject: "user_1" })
      .mutation(api.files.generateImageUploadUrl, {})
    expect(typeof url).toBe("string")
  })
  it("rejects an unauthenticated caller", async () => {
    const t = initConvexTest()
    await expect(
      t.mutation(api.files.generateImageUploadUrl, {})
    ).rejects.toThrow()
  })
})
