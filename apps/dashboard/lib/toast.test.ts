import { beforeEach, describe, expect, it, vi } from "vitest"

const { add } = vi.hoisted(() => ({ add: vi.fn(() => "toast-id") }))

vi.mock("@workspace/ui/components/toast", () => ({ toast: { add } }))

import { toast } from "@/lib/toast"

describe("toast", () => {
  beforeEach(() => {
    add.mockClear()
  })

  it("renders a success message with the success status icon", () => {
    toast.success("Role created")

    expect(add).toHaveBeenCalledWith({
      title: "Role created",
      type: "success",
    })
  })

  // Errors get priority "high" so assistive tech interrupts with them instead
  // of queueing them behind whatever else is being announced.
  it("announces an error urgently", () => {
    toast.error("Something went wrong")

    expect(add).toHaveBeenCalledWith({
      title: "Something went wrong",
      type: "error",
      priority: "high",
    })
  })
})
