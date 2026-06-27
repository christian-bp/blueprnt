import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { OtpField } from "./otp-field"

afterEach(() => cleanup())

describe("OtpField", () => {
  it("renders a labelled code input", () => {
    render(
      <OtpField
        value=""
        onChange={() => {}}
        onComplete={() => {}}
        ariaLabel="6-digit code"
      />
    )
    expect(screen.getByLabelText("6-digit code")).toBeDefined()
  })
})
