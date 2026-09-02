import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { PEOPLE_ARCHIVE_CHUNK_SIZE } from "@workspace/constants"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// NumberFlow's custom element does not exist in jsdom; the progress readout
// only needs to render its value.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1", name: "Acme", role: "admin" }),
}))

import { BulkArchivePeopleDialog } from "@/components/people/bulk-archive-people-dialog"
import { toast } from "@/lib/toast"
import { mockMutation } from "@/test/convex-mocks"

const archiveMock = mockMutation("people.people.archivePeople")
const m = messages.dashboard.people.bulkArchive

// Two chunks: PEOPLE_ARCHIVE_CHUNK_SIZE ids in the first, the remainder in
// the second, proving the dialog's loop actually splits the selection rather
// than sending it in one call.
const ids = Array.from(
  { length: PEOPLE_ARCHIVE_CHUNK_SIZE + 10 },
  (_, i) => `p${i + 1}`
)
const firstChunk = ids.slice(0, PEOPLE_ARCHIVE_CHUNK_SIZE)
const secondChunk = ids.slice(PEOPLE_ARCHIVE_CHUNK_SIZE)

function renderDialog(onArchived = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BulkArchivePeopleDialog
        open={true}
        onOpenChange={vi.fn()}
        personIds={ids}
        onArchived={onArchived}
      />
    </NextIntlClientProvider>
  )
  return { onArchived }
}

describe("BulkArchivePeopleDialog", () => {
  beforeEach(() => {
    archiveMock.mockReset()
    archiveMock
      .mockResolvedValueOnce({ archived: firstChunk.length })
      .mockResolvedValueOnce({ archived: secondChunk.length })
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("archives a selection larger than the chunk bound in successive chunks", async () => {
    const { onArchived } = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: m.confirm }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
    expect(archiveMock).toHaveBeenCalledTimes(2)
    expect(archiveMock.mock.calls[0]?.[0]).toEqual({
      orgId: "org1",
      personIds: firstChunk,
    })
    expect(archiveMock.mock.calls[1]?.[0]).toEqual({
      orgId: "org1",
      personIds: secondChunk,
    })
    expect(onArchived).toHaveBeenCalledTimes(1)
  })
})
