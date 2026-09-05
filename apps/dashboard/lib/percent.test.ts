import { createFormatter } from "next-intl"
import { describe, expect, it } from "vitest"
import {
  percentText,
  pointAmount,
  shownPercent,
  signedPercentText,
} from "@/lib/percent"

const format = createFormatter({ locale: "en" })

describe("percentText", () => {
  // The direction is carried by a word beside the figure, so the number
  // itself is unsigned wherever it appears.
  it("prints one decimal and drops the sign", () => {
    expect(percentText(13.74, format)).toBe("13.7%")
    expect(percentText(-4.1, format)).toBe("4.1%")
  })

  it("keeps the sign where a reading can go either way", () => {
    expect(signedPercentText(-4.1, format)).toBe("-4.1%")
    expect(signedPercentText(4.1, format)).toBe("+4.1%")
  })
})

describe("pointAmount", () => {
  // A movement between two percentages is a step in POINTS: printing it as a
  // percent would say a gap shrank by a twentieth of itself. The amount is
  // unsigned and unitless, because the sentence around it carries both.
  it("prints the size of the step, whichever way it went", () => {
    expect(pointAmount(-0.5, format)).toBe("0.5")
    expect(pointAmount(1.2, format)).toBe("1.2")
  })

  // Computed on the figures AS SHOWN, so a tile's own arithmetic adds up:
  // 14.2 minus 13.7 is half a point on screen whatever the raw readings were.
  it("matches the subtraction the reader can do on the tile", () => {
    expect(pointAmount(shownPercent(13.74) - shownPercent(14.15), format)).toBe(
      "0.5"
    )
  })
})
