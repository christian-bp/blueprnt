import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { pickSelectOption } from "@/test/select"

const designateMock = vi.fn()
const updateMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) =>
    ref === "assessment.anchorRoles.designateAnchorRole"
      ? designateMock
      : ref === "assessment.anchorRoles.updateAnchorRole"
        ? updateMock
        : vi.fn(),
  useQuery: (ref: unknown) =>
    ref === "assessment.anchorRoles.listAnchorRoles" ? [] : undefined,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    evaluationModel: { model: { getModel: "evaluationModel.model.getModel" } },
    assessment: {
      anchorRoles: {
        designateAnchorRole: "assessment.anchorRoles.designateAnchorRole",
        updateAnchorRole: "assessment.anchorRoles.updateAnchorRole",
        listAnchorRoles: "assessment.anchorRoles.listAnchorRoles",
      },
    },
  },
}))

import {
  AnchorDialog,
  type AnchorRoleInfo,
} from "@/components/roles/role-anchor-control"

const anchor = messages.dashboard.roles.anchor

const designated: AnchorRoleInfo = {
  expectedLevel: 2,
  motivation: "Reference role for the platform track",
  status: "active",
  reviewedAt: 1_700_000_000_000,
}

function wrap(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {node}
    </NextIntlClientProvider>
  )
}

// A stateful host so AnchorDialog actually unmounts its form when it closes on
// success (open flips to false via onOpenChange).
function HostedDialog({ anchorRole }: { anchorRole: AnchorRoleInfo | null }) {
  const [open, setOpen] = useState(true)
  return (
    <AnchorDialog
      open={open}
      onOpenChange={setOpen}
      orgId="org-1"
      roleId={"role-1" as never}
      anchorRole={anchorRole}
    />
  )
}

describe("AnchorDialog", () => {
  beforeEach(() => {
    designateMock.mockReset()
    updateMock.mockReset()
  })
  afterEach(() => cleanup())

  it("submits the designate form and closes on success", async () => {
    designateMock.mockResolvedValue(null)
    wrap(<HostedDialog anchorRole={null} />)

    // The real Base UI Select works inside the portaled dialog; drive its
    // popup listbox directly.
    await pickSelectOption(
      screen.getByRole("combobox", { name: anchor.expectedLevelLabel }),
      anchor.levelOption.replace("{level}", "2")
    )
    fireEvent.change(screen.getByLabelText(anchor.motivationLabel), {
      target: { value: "  Stable reference role.  " },
    })
    fireEvent.click(screen.getByRole("button", { name: anchor.designateCta }))

    await waitFor(() => {
      expect(designateMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        expectedLevel: 2,
        motivation: "Stable reference role.",
      })
    })
    await waitFor(() =>
      expect(screen.queryByLabelText(anchor.motivationLabel)).toBeNull()
    )
  })

  it("submits the edit form and closes on success", async () => {
    updateMock.mockResolvedValue(null)
    wrap(<HostedDialog anchorRole={designated} />)

    fireEvent.change(screen.getByLabelText(anchor.motivationLabel), {
      target: { value: "Updated rationale" },
    })
    fireEvent.click(screen.getByRole("button", { name: anchor.updateCta }))

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        motivation: "Updated rationale",
      })
    })
    await waitFor(() =>
      expect(screen.queryByLabelText(anchor.motivationLabel)).toBeNull()
    )
  })
})

// THE STATUS IS A CHOICE BETWEEN MEANINGS.
//
// It was a select of three words, which asks the reader to already know what
// each status does and to discover it by choosing it. Each card now carries
// the one sentence that says what the status changes, so the decision is
// readable before it is made.
describe("AnchorDialog status cards", () => {
  beforeEach(() => {
    designateMock.mockReset()
    updateMock.mockReset()
    updateMock.mockResolvedValue(null)
  })
  afterEach(() => cleanup())

  const CARDS = [
    ["active", anchor.statusActive, anchor.statusActiveMeaning],
    ["underReview", anchor.statusUnderReview, anchor.statusUnderReviewMeaning],
    ["replaced", anchor.statusReplaced, anchor.statusReplacedMeaning],
  ] as const

  it("offers all three statuses, each with its own meaning", () => {
    wrap(<HostedDialog anchorRole={designated} />)
    for (const [, name, meaning] of CARDS) {
      const radio = screen.getByRole("radio", { name: new RegExp(name) })
      expect(radio).toBeDefined()
      expect(screen.getByText(meaning)).toBeDefined()
    }
    // A choice, not a lookup: the select is gone.
    expect(
      screen.queryByRole("combobox", { name: anchor.statusLabel })
    ).toBeNull()
  })

  // The dialog opens on the anchor's current status, so the reader sees where
  // they are before they see where they could go.
  it("starts on the anchor's own status", () => {
    wrap(<HostedDialog anchorRole={designated} />)
    expect(
      screen
        .getByRole("radio", { name: new RegExp(anchor.statusActive) })
        .getAttribute("aria-checked")
    ).toBe("true")
  })

  it("drives the form value from the card the reader picks", async () => {
    wrap(<HostedDialog anchorRole={designated} />)
    fireEvent.click(
      screen.getByRole("radio", { name: new RegExp(anchor.statusUnderReview) })
    )
    fireEvent.click(screen.getByRole("button", { name: anchor.updateCta }))
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        status: "underReview",
      })
    })
  })

  // The gate is unchanged: an unmoved form cannot fire a mutation that would
  // still write an audit row. Picking the status it already has is not a
  // change, so the submit stays closed.
  it("keeps the submit closed until a card actually moves the status", () => {
    wrap(<HostedDialog anchorRole={designated} />)
    const submit = screen.getByRole("button", { name: anchor.updateCta })
    expect(submit.hasAttribute("disabled")).toBe(true)
    fireEvent.click(
      screen.getByRole("radio", { name: new RegExp(anchor.statusActive) })
    )
    expect(submit.hasAttribute("disabled")).toBe(true)
    fireEvent.click(
      screen.getByRole("radio", { name: new RegExp(anchor.statusReplaced) })
    )
    expect(submit.hasAttribute("disabled")).toBe(false)
  })

  // A CARD, not a radio in a row. The whole card is the label, so the
  // meaning sentence is part of the target and part of the accessible name,
  // and the chrome is the vendored Field pattern rather than per-call-site
  // classes. Three bare radios beside three sentences would read the same in
  // a snapshot and behave differently under a pointer.
  it("makes the whole card the control", () => {
    wrap(<HostedDialog anchorRole={designated} />)
    const radio = screen.getByRole("radio", {
      name: new RegExp(anchor.statusUnderReview),
    })
    // The accessible name carries the meaning, not only the status word.
    expect(radio.getAttribute("aria-labelledby")).toBeTruthy()
    const card = radio.closest("label") as HTMLElement
    expect(card).not.toBeNull()
    expect(card.className).toContain("has-[>[data-slot=field]]:border")
    expect(card.querySelector('[data-slot="field-description"]')).not.toBeNull()
  })

  // Every locale ships the three meanings; a card with an untranslated
  // description is a card that says nothing in that language.
  it("carries a name and a meaning in every locale", async () => {
    for (const locale of ["en", "sv", "nb", "da", "fi"] as const) {
      const file = (await import(`@workspace/i18n/messages/${locale}.json`))
        .default as typeof messages
      const a = file.dashboard.roles.anchor
      for (const key of [
        "statusActive",
        "statusUnderReview",
        "statusReplaced",
        "statusActiveMeaning",
        "statusUnderReviewMeaning",
        "statusReplacedMeaning",
      ] as const) {
        expect(a[key].trim().length).toBeGreaterThan(0)
      }
      // The meaning is a sentence about the status, never the name again.
      expect(a.statusActiveMeaning).not.toBe(a.statusActive)
    }
  })
})
