import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useImageUpload } from "./use-image-upload"

const labels = {
  invalidType: "bad type",
  tooLarge: "too large",
  error: "failed",
}

function makeFile(type: string, size: number): File {
  const f = new File(["x"], "a", { type })
  Object.defineProperty(f, "size", { value: size })
  return f
}

beforeEach(() => {
  // happy-dom lacks object URLs; stub them.
  globalThis.URL.createObjectURL = vi.fn(() => "blob:preview")
  globalThis.URL.revokeObjectURL = vi.fn()
  globalThis.fetch = vi.fn(
    async () =>
      new Response(JSON.stringify({ storageId: "s1" }), { status: 200 })
  )
})
afterEach(() => vi.restoreAllMocks())

describe("useImageUpload", () => {
  it("rejects a non-image before any upload", async () => {
    const setImage = vi.fn()
    const { result } = renderHook(() =>
      useImageUpload({
        generateUploadUrl: vi.fn(),
        setImage,
        removeImage: vi.fn(),
        labels,
      })
    )
    await act(async () => {
      await result.current.selectFile(makeFile("application/pdf", 10))
    })
    expect(result.current.error).toBe("bad type")
    expect(setImage).not.toHaveBeenCalled()
  })

  it("rejects an oversized image before any upload", async () => {
    const setImage = vi.fn()
    const { result } = renderHook(() =>
      useImageUpload({
        generateUploadUrl: vi.fn(),
        setImage,
        removeImage: vi.fn(),
        labels,
        maxBytes: 100,
      })
    )
    await act(async () => {
      await result.current.selectFile(makeFile("image/png", 200))
    })
    expect(result.current.error).toBe("too large")
    expect(setImage).not.toHaveBeenCalled()
  })

  it("uploads a valid image and mirrors the served url", async () => {
    const setImage = vi.fn(async () => "https://served/x")
    const onMirror = vi.fn(async () => {})
    const { result } = renderHook(() =>
      useImageUpload({
        generateUploadUrl: vi.fn(async () => "https://upload"),
        setImage,
        removeImage: vi.fn(),
        onMirror,
        labels,
      })
    )
    await act(async () => {
      await result.current.selectFile(makeFile("image/png", 10))
    })
    await waitFor(() => expect(setImage).toHaveBeenCalledWith("s1"))
    expect(onMirror).toHaveBeenCalledWith("https://served/x")
  })

  it("remove calls removeImage and mirrors null", async () => {
    const removeImage = vi.fn(async () => {})
    const onMirror = vi.fn(async () => {})
    const { result } = renderHook(() =>
      useImageUpload({
        generateUploadUrl: vi.fn(),
        setImage: vi.fn(async () => ""),
        removeImage,
        onMirror,
        labels,
      })
    )
    await act(async () => {
      await result.current.remove()
    })
    expect(removeImage).toHaveBeenCalled()
    expect(onMirror).toHaveBeenCalledWith(null)
  })
})
