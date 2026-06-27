import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import en from "@workspace/i18n/messages/en.json"

// --- Convex mutation mocks (vi.hoisted so they are defined before vi.mock) ---
// The component calls useMutation three times in order: generateAvatarUploadUrl,
// setMyAvatar, removeMyAvatar. We use call count to route to the right mock.
const { generateAvatarUploadUrlMock, setMyAvatarMock, removeMyAvatarMock } =
  vi.hoisted(() => {
    const generateAvatarUploadUrlMock = vi.fn(
      async () => "https://example.com/upload-url"
    )
    const setMyAvatarMock = vi.fn(
      async (_args: { storageId: string }) =>
        "https://example.com/avatar/served.jpg"
    )
    const removeMyAvatarMock = vi.fn(async () => null)
    return {
      generateAvatarUploadUrlMock,
      setMyAvatarMock,
      removeMyAvatarMock,
    }
  })

let useMutationCallCount = 0
vi.mock("convex/react", () => ({
  useMutation: () => {
    const idx = useMutationCallCount++
    if (idx === 0) return generateAvatarUploadUrlMock
    if (idx === 1) return setMyAvatarMock
    return removeMyAvatarMock
  },
}))

// --- Auth-client mock ---
const { updateUser, useSession } = vi.hoisted(() => ({
  updateUser: vi.fn(async () => ({ error: null })),
  useSession: vi.fn(
    (): {
      data: { user: { name: string; email: string; image: string | null } }
    } => ({
      data: {
        user: { name: "Jane Doe", email: "jane@example.com", image: null },
      },
    })
  ),
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: { updateUser, useSession },
}))

// --- global.fetch mock ---
const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ storageId: "kg123" }),
}))
vi.stubGlobal("fetch", fetchMock)

// --- URL.createObjectURL / revokeObjectURL stubs ---
vi.stubGlobal(
  "URL",
  Object.assign(URL, {
    createObjectURL: vi.fn(() => "blob:fake-preview-url"),
    revokeObjectURL: vi.fn(),
  })
)

import { AvatarUpload } from "./avatar-upload"

const t = en.dashboard.account.profile.avatar

function renderUpload() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AvatarUpload />
    </NextIntlClientProvider>
  )
}

function makeImageFile(overrides?: { size?: number; type?: string }) {
  const file = new File(["data"], "photo.jpg", {
    type: overrides?.type ?? "image/jpeg",
  })
  if (overrides?.size !== undefined) {
    Object.defineProperty(file, "size", { value: overrides.size })
  }
  return file
}

describe("AvatarUpload", () => {
  beforeEach(() => {
    useMutationCallCount = 0
    generateAvatarUploadUrlMock.mockResolvedValue(
      "https://example.com/upload-url"
    )
    setMyAvatarMock.mockResolvedValue("https://example.com/avatar/served.jpg")
    removeMyAvatarMock.mockResolvedValue(null)
    updateUser.mockResolvedValue({ error: null })
    useSession.mockReturnValue({
      data: {
        user: { name: "Jane Doe", email: "jane@example.com", image: null },
      },
    })
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: "kg123" }),
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("selecting a valid image runs the full upload flow", async () => {
    renderUpload()

    const input = document.querySelector("input[type=file]") as HTMLInputElement
    const file = makeImageFile()

    Object.defineProperty(input, "files", { value: [file], configurable: true })
    fireEvent.change(input)

    await waitFor(() => {
      expect(generateAvatarUploadUrlMock).toHaveBeenCalledWith({})
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.com/upload-url",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: file,
        })
      )
    })

    await waitFor(() => {
      expect(setMyAvatarMock).toHaveBeenCalledWith({ storageId: "kg123" })
    })

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({
        image: "https://example.com/avatar/served.jpg",
      })
    })
  })

  it("an oversized file shows tooLarge error and uploads nothing", async () => {
    renderUpload()

    const input = document.querySelector("input[type=file]") as HTMLInputElement
    const file = makeImageFile({ size: 6 * 1024 * 1024 })

    Object.defineProperty(input, "files", { value: [file], configurable: true })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByText(t.tooLarge)).toBeDefined()
    })

    expect(generateAvatarUploadUrlMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(setMyAvatarMock).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it("a non-image file shows invalidType error and uploads nothing", async () => {
    renderUpload()

    const input = document.querySelector("input[type=file]") as HTMLInputElement
    const file = makeImageFile({ type: "application/pdf" })

    Object.defineProperty(input, "files", { value: [file], configurable: true })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByText(t.invalidType)).toBeDefined()
    })

    expect(generateAvatarUploadUrlMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(setMyAvatarMock).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it("a failed upload shows the error message and does not call setMyAvatar", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ storageId: "" }),
    })

    renderUpload()

    const input = document.querySelector("input[type=file]") as HTMLInputElement
    const file = makeImageFile()

    Object.defineProperty(input, "files", { value: [file], configurable: true })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByText(t.error)).toBeDefined()
    })

    expect(setMyAvatarMock).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it("the remove button calls removeMyAvatar and updateUser with empty image", async () => {
    // Render with an existing image so the remove button is visible
    useSession.mockReturnValue({
      data: {
        user: {
          name: "Jane Doe",
          email: "jane@example.com",
          image: "https://example.com/avatar/current.jpg",
        },
      },
    })

    renderUpload()

    const removeBtn = screen.getByRole("button", { name: t.remove })
    fireEvent.click(removeBtn)

    await waitFor(() => {
      expect(removeMyAvatarMock).toHaveBeenCalledWith({})
    })

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ image: "" })
    })
  })
})
