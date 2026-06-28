import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AvatarUpload } from "./avatar-upload"

afterEach(() => cleanup())

function baseProps() {
  return {
    imageUrl: null,
    fallback: "AB",
    alt: "Acme",
    previewUrl: null,
    isUploading: false,
    isRemoving: false,
    error: null,
    onSelectFile: vi.fn(),
    onRemove: vi.fn(),
    removeLabel: "Remove",
  }
}

describe("AvatarUpload", () => {
  it("shows the fallback initials when there is no image", () => {
    render(<AvatarUpload {...baseProps()} />)
    expect(screen.getByText("AB")).toBeDefined()
  })
  it("forwards the chosen file to onSelectFile", () => {
    const props = baseProps()
    const { container } = render(<AvatarUpload {...props} />)
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const file = new File(["x"], "a.png", { type: "image/png" })
    fireEvent.change(input, { target: { files: [file] } })
    expect(props.onSelectFile).toHaveBeenCalledWith(file)
  })
  it("shows the remove control and the error when an image is present", () => {
    const props = { ...baseProps(), imageUrl: "https://x/y", error: "failed" }
    render(<AvatarUpload {...props} />)
    expect(screen.getByLabelText("Remove")).toBeDefined()
    expect(screen.getByText("failed")).toBeDefined()
  })
})
