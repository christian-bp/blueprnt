import { describe, expect, it } from "vitest"
import { BASE_PRAXIS_AREA_KEYS, PRAXIS_AREA_KEYS } from "./praxisAreas"

describe("praxis areas", () => {
  it("lists the statutory review areas with previousActions last", () => {
    expect(PRAXIS_AREA_KEYS).toEqual([
      "payPolicy",
      "collectiveAgreements",
      "benefits",
      "payPractices",
      "previousActions",
    ])
  })
  it("keeps the base set free of the conditional area", () => {
    expect(BASE_PRAXIS_AREA_KEYS).toEqual([
      "payPolicy",
      "collectiveAgreements",
      "benefits",
      "payPractices",
    ])
  })
})
