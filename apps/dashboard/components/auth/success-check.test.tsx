import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { SuccessCheck } from "./success-check"

afterEach(() => cleanup())

describe("SuccessCheck", () => {
  it("renders a decorative (aria-hidden) checkmark", () => {
    const { container } = render(<SuccessCheck />)
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })
})
