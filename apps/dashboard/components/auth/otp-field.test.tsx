import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { drainOtpMountTimers } from "@/test/otp-timers"
import { OtpField } from "./otp-field"

afterEach(async () => {
  cleanup()
  await drainOtpMountTimers()
})

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

  it("hides the slots and shows a labelled spinner while verifying", () => {
    render(
      <OtpField
        value="123456"
        onChange={() => {}}
        onComplete={() => {}}
        ariaLabel="6-digit code"
        verifying
        verifyingLabel="Verifying..."
      />
    )
    expect(screen.getByRole("status")).toBeDefined()
    expect(screen.getByText("Verifying...")).toBeDefined()
  })
})
