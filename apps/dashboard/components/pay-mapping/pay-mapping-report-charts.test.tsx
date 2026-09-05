import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { PDF_GENDER_INKS, pairedBarsHeight } from "./pay-mapping-report-charts"

// The report's marks are hand-drawn in sRGB hex, because a PDF cannot read a
// CSS variable. That makes the stylesheet and the report two copies of one
// palette, and nothing in either file can notice when they drift: the app
// keeps rendering the new ink and the report keeps printing the old one.
//
// So the test converts the stylesheet's own OKLCH values and compares. The
// conversion is the CSS Color 4 formula, the same one the browser runs.
function oklchToHex(l: number, c: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  return `#${rgb
    .map((channel) => {
      const clamped = Math.min(1, Math.max(0, channel))
      const encoded =
        clamped <= 0.0031308
          ? 12.92 * clamped
          : 1.055 * clamped ** (1 / 2.4) - 0.055
      return Math.round(encoded * 255)
        .toString(16)
        .padStart(2, "0")
    })
    .join("")}`
}

describe("pairedBarsHeight", () => {
  // The outline is centred on the bar's edge, so half of it hangs outside the
  // rect. Without room for it the top row printed with a flat top, clipped by
  // the canvas it sits in.
  it("leaves room for the outline the first and last rows hang over", () => {
    const oneRow = pairedBarsHeight(1)
    const twoRows = pairedBarsHeight(2)
    const rowHeight = twoRows - oneRow
    expect(oneRow).toBeGreaterThan(rowHeight)
    // One whole stroke: half above the first row, half below the last.
    expect(oneRow - rowHeight).toBeCloseTo(0.8, 5)
  })

  it("grows by exactly one row per row", () => {
    expect(pairedBarsHeight(4) - pairedBarsHeight(3)).toBeCloseTo(
      pairedBarsHeight(2) - pairedBarsHeight(1),
      5
    )
  })
})

describe("report chart inks", () => {
  const css = readFileSync(
    join(process.cwd(), "../../packages/ui/src/styles/globals.css"),
    "utf8"
  )
  // The LIGHT plane's value, which is the first declaration of each token: a
  // report prints on paper, and paper has no dark mode.
  const token = (name: string) => {
    const match = css.match(
      new RegExp(
        `--gender-${name}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`
      )
    )
    expect(match, `--gender-${name} is not declared in oklch`).not.toBeNull()
    return oklchToHex(
      Number(match?.[1]),
      Number(match?.[2]),
      Number(match?.[3])
    )
  }

  // Near, not equal. A colour outside the sRGB gamut is mapped by the
  // browser (and by lightningcss, which writes the hex fallback) by walking
  // its chroma down, while the formula above clamps each channel; the men's
  // ink is the one token far enough out for the two to disagree, by nine
  // steps on one channel. A real retune moves a hue by tens of steps, which
  // this still catches.
  const near = (actual: string, expected: string) => {
    const channels = (hex: string) =>
      [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16))
    const [a, b] = [channels(actual), channels(expected)]
    const drift = Math.max(...a.map((v, i) => Math.abs(v - (b[i] ?? 0))))
    expect(drift, `${actual} is not the stylesheet's ${expected}`).toBeLessThan(
      16
    )
  }

  it("prints the same four inks the app draws with", () => {
    near(PDF_GENDER_INKS.womanInk, token("woman"))
    near(PDF_GENDER_INKS.womanFill, token("woman-fill"))
    near(PDF_GENDER_INKS.manInk, token("man"))
    near(PDF_GENDER_INKS.manFill, token("man-fill"))
  })

  // The wash and its contour are two steps of one hue, never the same value:
  // a bar filled with its own outline colour has no edge on paper either.
  it("keeps every wash a step off its own ink", () => {
    expect(PDF_GENDER_INKS.womanFill).not.toBe(PDF_GENDER_INKS.womanInk)
    expect(PDF_GENDER_INKS.manFill).not.toBe(PDF_GENDER_INKS.manInk)
  })
})
