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

  it("swaps the input for a labelled spinner while verifying", () => {
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
    // The input (and with it the pasted code) is fully unmounted: nothing of
    // the entered digits can stay visible during the verify.
    expect(screen.queryByLabelText("6-digit code")).toBeNull()
    expect(screen.queryByText("1")).toBeNull()
  })

  it("refocuses the input after verifying ends", async () => {
    const { rerender } = render(
      <OtpField
        value="123456"
        onChange={() => {}}
        onComplete={() => {}}
        ariaLabel="6-digit code"
        verifying
      />
    )
    rerender(
      <OtpField
        value=""
        onChange={() => {}}
        onComplete={() => {}}
        ariaLabel="6-digit code"
      />
    )
    await drainOtpMountTimers()
    const input = screen.getByLabelText("6-digit code")
    expect(document.activeElement).toBe(input)
  })
})
