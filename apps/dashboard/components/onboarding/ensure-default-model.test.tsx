import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const useQueryMock = vi.fn()
const createMock = vi.fn()

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: () => createMock,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    evaluationModel: {
      model: {
        getModel: "evaluationModel.model.getModel",
        createModelFromTemplate:
          "evaluationModel.model.createModelFromTemplate",
      },
    },
  },
}))

import { EnsureDefaultModel } from "@/components/onboarding/ensure-default-model"

function renderEnsure() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <EnsureDefaultModel orgId="org-1">
        <div data-testid="child">families</div>
      </EnsureDefaultModel>
    </NextIntlClientProvider>
  )
}

describe("EnsureDefaultModel", () => {
  beforeEach(() => {
    useQueryMock.mockReset()
    createMock.mockReset()
    createMock.mockResolvedValue("model-1")
  })
  afterEach(() => cleanup())

  it("renders children and does not create when a model already exists", () => {
    useQueryMock.mockReturnValue({ modelId: "model-1", criteria: [] })
    renderEnsure()
    expect(screen.getByTestId("child")).toBeDefined()
    expect(createMock).not.toHaveBeenCalled()
  })

  it("shows a spinner while the model query is loading, without creating", () => {
    useQueryMock.mockReturnValue(undefined)
    renderEnsure()
    expect(
      screen.getByLabelText(messages.dashboard.onboarding.loading)
    ).toBeDefined()
    expect(screen.queryByTestId("child")).toBeNull()
    expect(createMock).not.toHaveBeenCalled()
  })

  it("creates the default model when none exists, holding the spinner", async () => {
    useQueryMock.mockReturnValue(null)
    renderEnsure()
    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({ orgId: "org-1" })
    })
    // Still no children until the model query resolves to a model.
    expect(screen.queryByTestId("child")).toBeNull()
    expect(
      screen.getByLabelText(messages.dashboard.onboarding.loading)
    ).toBeDefined()
  })

  it("offers a retry when creating the model fails", async () => {
    useQueryMock.mockReturnValue(null)
    createMock.mockRejectedValueOnce(new Error("ConvexError"))
    renderEnsure()
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    const retry = screen.getByRole("button", {
      name: messages.dashboard.model.retry,
    })
    createMock.mockResolvedValueOnce("model-1")
    retry.click()
    await waitFor(() => {
      expect(createMock).toHaveBeenCalledTimes(2)
    })
  })
})
