import { describe, expect, it } from "vitest"
import {
  PAY_GAP_REASON_GROUP_KEYS,
  PAY_GAP_REASON_GROUPS,
  PAY_GAP_REASONS,
} from "./payGapReasons"

describe("pay gap reason taxonomy", () => {
  it("flattens the groups in group order without duplicates", () => {
    expect(PAY_GAP_REASONS).toEqual([
      "alternativeLabourMarket",
      "recruitmentPayLevel",
      "experience",
      "historicalPay",
      "competence",
      "performance",
      "responsibility",
    ])
    expect(new Set(PAY_GAP_REASONS).size).toBe(PAY_GAP_REASONS.length)
  })

  it("keys the groups market/individual/work", () => {
    expect(PAY_GAP_REASON_GROUP_KEYS).toEqual(["market", "individual", "work"])
    expect(PAY_GAP_REASON_GROUPS.work).toEqual(["responsibility"])
  })
})
