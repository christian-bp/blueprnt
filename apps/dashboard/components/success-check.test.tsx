import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { SuccessCheck } from "./success-check"

afterEach(() => cleanup())

describe("SuccessCheck", () => {
  it("renders a decorative (aria-hidden) success badge with a check icon", () => {
    const { container } = render(<SuccessCheck />)
    const badge = container.querySelector('[aria-hidden="true"]')
    expect(badge).not.toBeNull()
    expect(badge?.querySelector("svg")).not.toBeNull()
  })
})
