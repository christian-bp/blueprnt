import { afterEach, describe, expect, it, vi } from "vitest"
import {
  canRasterizeCharts,
  captureSvgToPng,
  stripUrlOrigins,
} from "./chart-capture"

describe("stripUrlOrigins", () => {
  it("reduces absolute local references to their fragment", () => {
    expect(stripUrlOrigins('url("http://localhost:3000/x/y#hatch-1")')).toBe(
      'url("#hatch-1")'
    )
    expect(stripUrlOrigins("url(http://host/page#clip)")).toBe("url(#clip)")
  })

  it("leaves fragment-only and external references alone", () => {
    expect(stripUrlOrigins("url(#hatch-1)")).toBe("url(#hatch-1)")
    expect(stripUrlOrigins('url("#hatch-1")')).toBe('url("#hatch-1")')
    expect(stripUrlOrigins("url(https://host/image.png)")).toBe(
      "url(https://host/image.png)"
    )
  })

  it("rewrites every reference in a value", () => {
    expect(stripUrlOrigins("url(http://h/p#a) url(http://h/p#b)")).toBe(
      "url(#a) url(#b)"
    )
  })
})

describe("canRasterizeCharts", () => {
  it("answers no in an environment without a 2d canvas", () => {
    // jsdom has no canvas implementation, which is exactly the case the
    // export's fallback path exists for.
    expect(canRasterizeCharts()).toBe(false)
  })
})

describe("captureSvgToPng", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("serializes a standalone SVG and returns the rasterized PNG", async () => {
    let captured = ""
    class FakeImage {
      set src(value: string) {
        captured = value
      }
      decode() {
        return Promise.resolve()
      }
    }
    vi.stubGlobal("Image", FakeImage)
    const context = { scale: vi.fn(), drawImage: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    )
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,PNG"
    )
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.appendChild(
      document.createElementNS("http://www.w3.org/2000/svg", "rect")
    )
    svg.getBoundingClientRect = () => ({ width: 640, height: 160 }) as DOMRect

    const result = await captureSvgToPng(svg, 2)

    expect(result).toEqual({
      src: "data:image/png;base64,PNG",
      width: 640,
      height: 160,
    })
    const markup = decodeURIComponent(
      captured.replace("data:image/svg+xml;charset=utf-8,", "")
    )
    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(markup).toContain('width="640"')
    expect(markup).toContain('height="160"')
    expect(markup).toContain("<rect")
    expect(context.scale).toHaveBeenCalledWith(2, 2)
    expect(context.drawImage).toHaveBeenCalled()
  })

  it("refuses an unrendered chart instead of producing an empty image", async () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    await expect(captureSvgToPng(svg)).rejects.toThrow("chart has no size")
  })

  it("times out a decode that never completes instead of hanging the export", async () => {
    // A fully hidden tab can defer image work indefinitely; the capture
    // must reject (and the caller fall back to vector charts), never wait.
    class HangingImage {
      set src(_value: string) {}
      decode() {
        return new Promise<never>(() => {})
      }
    }
    vi.stubGlobal("Image", HangingImage)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.getBoundingClientRect = () => ({ width: 640, height: 160 }) as DOMRect
    await expect(captureSvgToPng(svg, 3, 40)).rejects.toThrow(
      "decode timed out"
    )
  })
})
