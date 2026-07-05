import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FileDropzone } from "./file-dropzone"

function renderDropzone(onFile: (file: File) => void, ariaLabel?: string) {
  return render(
    <FileDropzone
      accept=".csv,text/csv"
      onFile={onFile}
      title="Drop files here"
      subtitle="or click to browse from your device"
      ariaLabel={ariaLabel}
    />
  )
}

describe("FileDropzone", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the title and subtitle", () => {
    renderDropzone(vi.fn())
    expect(screen.getByText("Drop files here")).toBeDefined()
    expect(
      screen.getByText("or click to browse from your device")
    ).toBeDefined()
  })

  it("labels the region with ariaLabel, falling back to the title", () => {
    const { unmount } = renderDropzone(vi.fn(), "Upload a CSV file")
    expect(
      screen.getByRole("region", { name: "Upload a CSV file" })
    ).toBeDefined()
    unmount()
    renderDropzone(vi.fn())
    expect(
      screen.getByRole("region", { name: "Drop files here" })
    ).toBeDefined()
  })

  it("calls onFile with the first dropped file", () => {
    const onFile = vi.fn<(file: File) => void>()
    renderDropzone(onFile)
    const file = new File(["a,b\n1,2"], "data.csv", { type: "text/csv" })
    fireEvent.drop(screen.getByRole("region"), {
      dataTransfer: { files: [file] },
    })
    expect(onFile).toHaveBeenCalledWith(file)
  })

  it("calls onFile when a file is selected via the input", () => {
    const onFile = vi.fn<(file: File) => void>()
    renderDropzone(onFile)
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const file = new File(["x"], "data.csv", { type: "text/csv" })
    Object.defineProperty(input, "files", { value: [file] })
    fireEvent.change(input)
    expect(onFile).toHaveBeenCalledWith(file)
  })
})
