import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { MAX_FAMILY_NAME, MAX_ROLE_TITLE } from "@workspace/constants"
import messages from "@workspace/i18n/messages/en.json"
import { createTranslator, NextIntlClientProvider } from "next-intl"
import { useRef, useState } from "react"
import { afterEach, describe, expect, it } from "vitest"

import {
  type ReviewAnnotations,
  type ReviewRegister,
  FamilyReviewTable,
} from "@/components/family-review-table"
import type { DraftFamily } from "@/lib/family-dnd"
import { openMenu } from "@/test/menu"

const t = messages.dashboard.familyTable

// roleCount is an ICU plural, so its rendered text is formatted from the
// message file rather than restated here.
const formatFamily = createTranslator({
  locale: "en",
  messages,
  namespace: "dashboard.roles.family",
})
const roleCount = (count: number) => formatFamily("roleCount", { count })
const familyLabel = messages.dashboard.roles.family.nameLabel
const titleLabel = messages.dashboard.roles.create.titleLabel
const trackLabel = messages.dashboard.roles.create.trackLabel

const removeRole = (title: string) => t.removeRole.replace("{title}", title)
const dragHandle = (title: string) => t.dragHandle.replace("{title}", title)
const familyActions = (name: string) => t.familyActions.replace("{name}", name)
const familyMenu = messages.dashboard.roles.family

/** The family's one trailing row-actions menu, opened. */
async function openFamilyMenu(name: string) {
  const trigger = screen.getByRole("button", { name: familyActions(name) })
  await openMenu(trigger)
  return trigger
}

/** Picks one item out of a family's open row-actions menu. */
async function chooseFamilyAction(name: string, item: string) {
  await openFamilyMenu(name)
  fireEvent.click(screen.getByRole("menuitem", { name: item }))
}

/** Opens a created family's name field, which is closed until asked for. */
async function openName(name: string) {
  await chooseFamilyAction(name, familyMenu.renameCta)
  return screen.getByLabelText(familyLabel) as HTMLInputElement
}

const TRACKS = [
  { trackKey: "IC", label: "Individual Contributor" },
  { trackKey: "Lead", label: "Lead" },
]

const ENG = "fam_eng" as Id<"roleFamilies">
const FIN = "fam_fin" as Id<"roleFamilies">

const NO_ANNOTATIONS: ReviewAnnotations = {
  collidingFamilyIds: new Set<number>(),
  nameMissingFamilyIds: new Set<number>(),
  duplicateRoleIds: new Set<number>(),
  blankRoleIds: new Set<number>(),
}

function registerEntry(roles: { id: string; title: string }[]) {
  return {
    roles: roles.map((role) => ({
      ...role,
      trackKey: "IC",
      trackName: "Individual Contributor",
    })),
  }
}

function registerFixture(): ReviewRegister {
  return new Map([
    [
      ENG as string,
      registerEntry([
        { id: "role-dev", title: "Developer" },
        { id: "role-sre", title: "SRE" },
      ]),
    ],
    [FIN as string, registerEntry([{ id: "role-ctrl", title: "Controller" }])],
  ])
}

// Engineering is a family the org has and the proposal targets, Legal one the
// import would create, Finance one the org has and nothing is being added to.
function registerDraft(): DraftFamily[] {
  return [
    {
      id: 1,
      familyId: ENG,
      name: "Engineering",
      roles: [{ id: 2, title: "Platform Engineer", trackKey: "IC" }],
    },
    {
      id: 3,
      name: "Legal",
      roles: [{ id: 4, title: "Counsel", trackKey: "IC" }],
    },
    { id: 5, familyId: FIN, name: "Finance", roles: [] },
  ]
}

function Harness({
  initial = registerDraft,
  annotations = NO_ANNOTATIONS,
  register = registerFixture(),
}: {
  initial?: () => DraftFamily[]
  annotations?: ReviewAnnotations
  // Onboarding renders this table with no register at all, which is how a
  // group can carry a real familyId and still be removable.
  register?: ReviewRegister
}) {
  const [families, setFamilies] = useState(initial)
  const nextId = useRef(100)
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <FamilyReviewTable
        families={families}
        onFamiliesChange={(updater) =>
          setFamilies((current) => updater(current))
        }
        claimId={() => {
          const id = nextId.current
          nextId.current += 1
          return id
        }}
        trackOptions={TRACKS}
        annotations={annotations}
        register={register}
      />
    </NextIntlClientProvider>
  )
}

/** The row an element sits in. */
function rowOf(element: Element): HTMLElement {
  const row = element.closest("tr")
  if (row === null) throw new Error("element is not inside a row")
  return row
}

/** The family group (one tbody per family) an element sits in. */
function groupOf(element: Element): HTMLElement {
  const group = element.closest("tbody")
  if (group === null) throw new Error("element is not inside a family group")
  return group
}

const groups = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="table-body"]')

describe("FamilyReviewTable structure", () => {
  afterEach(() => {
    cleanup()
  })

  // One frame, one table: the whole register reads as a single register
  // rather than as a wall of cards.
  // TableBody ships [&_tr:last-child]:border-0, written for a table with ONE
  // tbody where the only last row is the table's own. This table has a tbody
  // per family, so that vendor rule strips the rule under EVERY family's last
  // row and the next family's header sits straight on top of it. Restored on
  // every group but the last, whose border would double against the frame.
  // The same content as the roles register's family row, so it reads as the
  // same row: name, then the count of what the family already holds. A family
  // this import would create has nothing yet, and a "0" there would read as a
  // fact about the org rather than as the absence of one.
  it("counts the roles a family already has, and none on one being created", () => {
    render(<Harness />)
    const engineering = rowOf(screen.getByText("Engineering"))
    // The register fixture gives Engineering two roles and Finance one.
    expect(within(engineering).getByText(roleCount(2))).toBeTruthy()
    const finance = rowOf(screen.getByText("Finance"))
    expect(within(finance).getByText(roleCount(1))).toBeTruthy()
    // Legal is created by this import: a name, and no count beside it.
    const legal = rowOf(screen.getByText("Legal"))
    expect(within(legal).queryByText(/\d+\s+role/)).toBeNull()
  })

  it("keeps a rule under each family's last row, except the table's own", () => {
    const view = render(<Harness />)
    const bodies = Array.from(groups(view.container))
    expect(bodies.length).toBeGreaterThan(1)
    for (const body of bodies.slice(0, -1)) {
      expect(body.className).toContain("[&_tr:last-child]:border-b")
    }
    expect(bodies[bodies.length - 1]?.className).not.toContain(
      "[&_tr:last-child]:border-b"
    )
  })

  // Every row type has to add up to the heading count. This table carries
  // three of them (a family band, an editable proposed role, and a read-only
  // register role), so it is the surface where a short row is
  // easiest to introduce and hardest to see: the table is table-fixed, so a
  // missing cell leaves no gap at the end and instead slides every later value
  // one column left under someone else's heading. That shipped once on the
  // family register page and nothing failed, because nothing counted. It now
  // backs BOTH onboarding and the in-app import, so a short row would land on
  // two surfaces at once.
  it("gives every row a full set of columns", () => {
    const view = render(<Harness />)
    const headings = view.container.querySelectorAll("thead th")
    expect(headings.length).toBeGreaterThan(0)
    const rows = view.container.querySelectorAll("tbody tr")
    expect(rows.length).toBeGreaterThan(0)
    let spanning = 0
    let full = 0
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td"))
      // A row's widths must sum to the heading count whether it spans or not.
      const width = cells.reduce(
        (total, cell) => total + Number(cell.getAttribute("colspan") ?? 1),
        0
      )
      expect(width).toBe(headings.length)
      if (cells.some((cell) => cell.hasAttribute("colspan"))) spanning++
      else full++
    }
    // Neither branch may be vacuous: the fixture renders both kinds.
    expect(spanning).toBeGreaterThan(0)
    expect(full).toBeGreaterThan(0)
  })

  it("renders one bordered frame holding one table, with a group per family", () => {
    const view = render(<Harness />)
    const tables = view.container.querySelectorAll("table")
    expect(tables).toHaveLength(1)
    // A plain bordered frame, not a Card: a Card has to give up its padding,
    // its gap and its shadow to hold a table, and the border is all that is
    // left of it. Asserted as an absence so re-wrapping this in one fails here.
    expect(view.container.querySelectorAll('[data-slot="card"]')).toHaveLength(
      0
    )
    // Two levels up, not one: shadcn's Table renders its own
    // overflow-x-auto scroll wrapper around the <table>, so the frame is that
    // wrapper's parent.
    const frame = tables[0]?.parentElement?.parentElement
    expect(frame?.className).toContain("border")
    // What lets the header fill and the family bands run to the frame's edge
    // without squaring off its corners.
    expect(frame?.className).toContain("overflow-hidden")
    // One tbody per family. Add-family lives below the frame, not in the table.
    expect(groups(view.container)).toHaveLength(3)
  })

  // The two data columns are labelled on screen; the two control columns carry
  // their name for assistive tech only, so a cell is never announced under a
  // blank column and no word is spent heading a drag handle.
  it("shows the data column headings and names the control columns for assistive tech", () => {
    render(<Harness />)
    const header = screen.getByText(t.columnRole).closest("thead")
    if (header === null) throw new Error("no table header")
    for (const label of [t.columnRole, t.columnTrack]) {
      expect(within(header).getByText(label).className).not.toContain("sr-only")
    }
    for (const label of [t.columnMove, t.columnRemove]) {
      expect(within(header).getByText(label).className).toContain("sr-only")
    }
  })

  // The load-bearing detail, still true now that the row is visible again:
  // table-fixed takes its column widths from the first row, so the header cells
  // have to stay IN FLOW and keep carrying the width classes. Putting sr-only
  // (absolute, 1px) on a header CELL instead of on a span inside it would hand
  // every width below to whatever the first family group happens to hold.
  it("keeps the header cells in flow so the column widths survive", () => {
    render(<Harness />)
    const header = screen.getByText(t.columnRole).closest("thead")
    if (header === null) throw new Error("no table header")
    const cells = header.querySelectorAll("th")
    expect(cells).toHaveLength(4)
    for (const cell of cells) {
      expect(cell.className).not.toContain("sr-only")
    }
    // And the widths are declared on them, not left to the body.
    expect(cells[0]?.className).toContain("w-12")
    expect(cells[2]?.className).toContain("w-48")
    expect(cells[3]?.className).toContain("w-12")
  })

  // Every name reads as static text, so the header band is one line in every
  // group rather than a field in one and a label in another. The field is
  // behind the menu's Rename, and only a family this import would create has
  // that item at all.
  it("renders every family's name as text, with Rename only on a created one", async () => {
    render(<Harness />)
    expect(screen.queryByLabelText(familyLabel)).toBeNull()
    for (const name of ["Engineering", "Legal", "Finance"]) {
      expect(screen.getByText(name)).toBeTruthy()
    }
    await openFamilyMenu("Legal")
    expect(
      screen.getByRole("menuitem", { name: familyMenu.renameCta })
    ).toBeTruthy()
  })

  // The field is what Rename reveals, and it closes again on Enter, so the
  // band returns to one line without a second control to find.
  it("opens the name as a field on rename and closes it on Enter", async () => {
    render(<Harness />)
    const field = await openName("Legal")
    expect(field.value).toBe("Legal")
    fireEvent.change(field, { target: { value: "Legal & Compliance" } })
    fireEvent.keyDown(field, { key: "Enter" })
    expect(screen.queryByLabelText(familyLabel)).toBeNull()
    expect(screen.getByText("Legal & Compliance")).toBeTruthy()
  })

  // Nothing is collapsed and nothing sits behind a disclosure: seeing the SRE
  // already in Engineering is what makes a duplicate flag explainable.
  it("puts every role the org already has in its own family's group", () => {
    render(<Harness />)
    const engineering = groupOf(screen.getByText("Engineering"))
    for (const title of ["Developer", "SRE"]) {
      expect(within(engineering).getByText(title)).toBeTruthy()
    }
    // And the proposed row sits in the same group, below them.
    expect(
      within(engineering).getByDisplayValue("Platform Engineer")
    ).toBeTruthy()
    expect(
      within(groupOf(screen.getByText("Finance"))).getByText("Controller")
    ).toBeTruthy()
  })

  // The invariant the whole screen rests on: everything removable here is
  // something that does not exist yet. The confirm is purely additive, so a
  // control on a role the org already has would take an edit and discard it,
  // and a remove would empty the row off the screen and change nothing.
  it("gives a role the org already has no control of any kind", () => {
    render(<Harness />)
    const row = rowOf(screen.getByText("Developer"))
    expect(
      row.querySelectorAll("input, select, button, [role='combobox']")
    ).toHaveLength(0)
    // The track shows as a badge, so it must not have become a control either.
    expect(row.querySelectorAll('[data-slot="select-trigger"]')).toHaveLength(0)
    // Not draggable: moving a role between families is a mutation this screen
    // cannot perform.
    expect(screen.queryByLabelText(dragHandle("Developer"))).toBeNull()
  })

  // The two row types have to read as one table, not as two interleaved ones,
  // so a static row RESERVES the handle's and the remove control's cells
  // instead of dropping them and letting the title absorb their width.
  it("gives a static row the same cells, in the same order, as a proposed one", () => {
    render(<Harness />)
    const staticRow = rowOf(screen.getByText("Developer"))
    const proposedRow = rowOf(screen.getByDisplayValue("Platform Engineer"))
    const staticCells = staticRow.querySelectorAll("td")
    const proposedCells = proposedRow.querySelectorAll("td")
    expect(staticCells).toHaveLength(4)
    expect(proposedCells).toHaveLength(4)
    // The reserved cells are empty, and every column carries the same width
    // class in both rows, which is what keeps the title and the track aligned.
    expect(staticCells[0]?.textContent).toBe("")
    expect(staticCells[3]?.textContent).toBe("")
    for (const index of [0, 1, 2, 3]) {
      expect(staticCells[index]?.className).toBe(
        proposedCells[index]?.className
      )
    }
  })

  // The remove control used to sit flush against the track select (zero cell
  // padding on that side), close enough to read as drawn inside it. It needs
  // its own gutter, and it needs a real box of its own to anchor its
  // absolutely positioned trigger against: a bare RemoveConfirm span is a
  // plain inline element and would otherwise measure zero width, anchoring
  // its trigger back into the PREVIOUS cell instead of this one.
  it("gives the remove control its own cell, separated from the track column", () => {
    render(<Harness />)
    const row = rowOf(screen.getByDisplayValue("Platform Engineer"))
    const removeCell = row.querySelectorAll("td")[3]
    if (removeCell === undefined) throw new Error("no remove cell")
    expect(removeCell.className).toContain("pl-3")
    expect(removeCell.className).not.toContain("px-0")
    // A real flex box around the control, not a bare child of the cell.
    expect(removeCell.querySelector(".flex")).toBeTruthy()
    expect(
      within(removeCell).getByRole("button", {
        name: removeRole("Platform Engineer"),
      })
    ).toBeTruthy()
  })

  // The invariant, stated at the one surface that could break it now that the
  // family's actions live behind a menu: a family the org already has offers
  // add-role and NOTHING else. Rename would suggest a rename this screen
  // cannot perform, and remove would confirm, take the group off the screen
  // and change nothing.
  it("offers no rename and no remove on a family the org already has", async () => {
    render(<Harness />)
    for (const name of ["Engineering", "Finance"]) {
      await openFamilyMenu(name)
      const items = screen.getAllByRole("menuitem")
      expect(items.map((item) => item.textContent)).toEqual([t.addRoleShort])
      expect(
        screen.queryByRole("menuitem", { name: familyMenu.renameCta })
      ).toBeNull()
      expect(
        screen.queryByRole("menuitem", { name: familyMenu.removeCta })
      ).toBeNull()
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      })
    }
    for (const title of ["Developer", "SRE", "Controller"]) {
      expect(
        screen.queryByRole("button", { name: removeRole(title) })
      ).toBeNull()
    }
  })

  // A family this import would create carries the full menu, and a proposed
  // row inside a family that already exists keeps its own remove control.
  it("offers add, rename and remove on a family this import would create", async () => {
    render(<Harness />)
    await openFamilyMenu("Legal")
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      t.addRoleShort,
      familyMenu.renameCta,
      familyMenu.removeCta,
    ])
    expect(
      screen.getByRole("menuitem", { name: familyMenu.removeCta }).dataset
        .variant
    ).toBe("destructive")
    expect(
      screen.getByRole("button", { name: removeRole("Platform Engineer") })
    ).toBeTruthy()
  })

  // The warning has to match what removal actually DOES, and that turns on
  // whether the family exists, not on which surface is asking. Onboarding
  // renders this table with no register, and its template path creates the
  // starter set before the review, so a group there can carry a real familyId:
  // removing it archives its roles on the next step. Telling that user
  // "nothing in your register changes" would promise the opposite.
  it("warns that removing an existing family archives its roles", async () => {
    render(<Harness register={new Map()} />)
    // Engineering carries a familyId; with no register it is still removable.
    await chooseFamilyAction("Engineering", familyMenu.removeCta)
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog.textContent).toContain(t.removeFamilyDescriptionExisting)
    expect(dialog.textContent).not.toContain(t.removeFamilyDescription)
  })

  // ...and a group this flow would only ever create still gets the reassuring
  // copy, which is accurate for it.
  it("says nothing changes when removing a family that does not exist yet", async () => {
    render(<Harness register={new Map()} />)
    await chooseFamilyAction("Legal", familyMenu.removeCta)
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog.textContent).toContain(t.removeFamilyDescription)
    expect(dialog.textContent).not.toContain(t.removeFamilyDescriptionExisting)
  })

  // Onboarding's resume seed collects every family-less role into ONE
  // synthetic group: it has no familyId, because no such family exists, but
  // every role in it is real and reconcile archives the lot on Next. The
  // group's own id therefore cannot decide the warning; a written ROLE counts
  // as existing too.
  it("warns about a group of real roles that has no family of its own", async () => {
    render(
      <Harness
        register={new Map()}
        initial={() => [
          {
            id: 9,
            name: "Other roles",
            roles: [
              {
                id: 10,
                roleId: "role-real" as Id<"roles">,
                title: "Analyst",
                trackKey: "IC",
              },
            ],
          },
        ]}
      />
    )
    await chooseFamilyAction("Other roles", familyMenu.removeCta)
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog.textContent).toContain(t.removeFamilyDescriptionExisting)
    expect(dialog.textContent).not.toContain(t.removeFamilyDescription)
  })

  // The menu returns focus to its trigger as a microtask, AFTER the field has
  // mounted and taken the caret, so a synchronous read never observes it: the
  // guard that keeps the field alive through that blur is invisible without an
  // await. Fired explicitly here, because that is the blur the field must
  // survive and the one every other test in this file skips past.
  it("keeps the name field open when focus returns to its own menu trigger", async () => {
    render(<Harness />)
    const field = await openName("Legal")
    const trigger = screen.getByRole("button", {
      name: familyActions("Legal"),
    })
    // Exactly what the menu's restore does: focus leaves the field for the
    // trigger that opened it.
    fireEvent.blur(field, { relatedTarget: trigger })
    await Promise.resolve()
    expect(screen.queryByLabelText(familyLabel)).not.toBeNull()
  })

  // ...and a blur to anywhere else still puts it away, so the guard cannot
  // leave a field that can never be closed.
  it("closes the name field when focus leaves the row", async () => {
    render(<Harness />)
    const field = await openName("Legal")
    fireEvent.blur(field, { relatedTarget: document.body })
    await Promise.resolve()
    expect(screen.queryByLabelText(familyLabel)).toBeNull()
  })

  // Remove is destructive and irreversible on this screen, so it confirms
  // through an AlertDialog rather than dropping the group on the click.
  it("removes a created family only after the alert dialog is confirmed", async () => {
    const view = render(<Harness />)
    await chooseFamilyAction("Legal", familyMenu.removeCta)
    expect(await screen.findByRole("alertdialog")).toBeTruthy()
    // Nothing gone yet: the group is still on screen behind the dialog.
    expect(groups(view.container)).toHaveLength(3)

    fireEvent.click(screen.getByRole("button", { name: t.removeFamilyConfirm }))
    expect(groups(view.container)).toHaveLength(2)
    expect(screen.queryByText("Legal")).toBeNull()
  })

  it("keeps a created family when the removal is cancelled", async () => {
    const view = render(<Harness />)
    await chooseFamilyAction("Legal", familyMenu.removeCta)
    expect(await screen.findByRole("alertdialog")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: familyMenu.cancel }))
    expect(groups(view.container)).toHaveLength(3)
    expect(screen.getByText("Legal")).toBeTruthy()
  })

  it("edits a proposed row's title and track through the updater", () => {
    render(<Harness />)
    const title = screen.getByDisplayValue("Platform Engineer")
    fireEvent.change(title, { target: { value: "Platform Lead" } })
    expect((title as HTMLInputElement).value).toBe("Platform Lead")
    expect(screen.getAllByLabelText(trackLabel)).toHaveLength(2)
  })

  // The caps are enforced by the server over the whole payload, so a field
  // that accepts more than the write will take turns one long paste into an
  // untargeted rejection of the entire list.
  it("caps the family name and role title at the import's field limits", async () => {
    render(<Harness />)
    expect((await openName("Legal")).maxLength).toBe(MAX_FAMILY_NAME)
    expect(
      (screen.getByDisplayValue("Counsel") as HTMLInputElement).maxLength
    ).toBe(MAX_ROLE_TITLE)
  })

  // The header is a one-line label and must stay sized to its text. It once
  // ran three times a role row's height because a 36px control sat in a cell
  // that already had padding, which on a register of forty families is most of
  // the screen. Nothing about a height is observable in this environment, so
  // the guard is on what sets it: the menu trigger stays at the small end of
  // the button scale, so the cell's default box already fits the row, and no
  // cell carries a vertical-padding override, since a py- on any ONE of them
  // would set the whole row's height by itself.
  it("keeps the family header a one-line band", () => {
    render(<Harness />)
    const trigger = screen.getByRole("button", {
      name: familyActions("Engineering"),
    })
    expect(trigger.className).toContain("size-6")
    expect(trigger.className).not.toContain("size-9")
    for (const cell of rowOf(trigger).querySelectorAll("td")) {
      // The vendor default carries p-2 of its own (no separate py- token);
      // the guard is that no cell ADDS a py- override on top of it.
      const pys = cell.className.split(/\s+/).filter((c) => /^py-/.test(c))
      expect(pys).toEqual([])
    }
  })

  // A screen reader's element list shows the accessible name, and forty
  // identical "Family actions" entries cannot be told apart.
  it("names the family in the row menu's accessible name", () => {
    render(<Harness />)
    for (const name of ["Engineering", "Legal", "Finance"]) {
      expect(
        screen
          .getByRole("button", { name: familyActions(name) })
          .getAttribute("aria-label")
      ).toBe(familyActions(name))
    }
  })

  // Every family's menu offers add-role, including the one nothing is proposed
  // for and the ones the org already has: adding a role to an existing family
  // is the whole feature, and it is additive, so it breaks no invariant.
  it("adds a role to any family from its menu", async () => {
    render(<Harness />)
    await chooseFamilyAction("Finance", t.addRoleShort)
    const finance = groupOf(screen.getByText("Finance"))
    const added = within(finance).getAllByLabelText(titleLabel)
    expect(added).toHaveLength(1)
    expect((added[0] as HTMLInputElement).value).toBe("")
  })

  // The one trailing menu sits in the row's own remove column, so it lines up
  // with the remove control of every role row beneath it instead of floating
  // at the right of a wide band where it read as belonging to Track.
  it("puts the family menu in the remove column of its header row", () => {
    render(<Harness />)
    for (const name of ["Engineering", "Legal", "Finance"]) {
      const trigger = screen.getByRole("button", { name: familyActions(name) })
      const cells = rowOf(trigger).querySelectorAll("td")
      // Two cells: the name spans the first three columns, the menu takes the
      // fourth, which is the same column every role row's remove control uses.
      expect(cells).toHaveLength(2)
      expect(cells[0]?.getAttribute("colspan")).toBe("3")
      expect(cells[1]?.className).toContain("pl-3")
      expect(cells[1]?.contains(trigger)).toBe(true)
    }
  })

  it("appends an empty family", () => {
    const view = render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: t.addFamily }))
    // One tbody per family, so adding one adds a group.
    expect(groups(view.container)).toHaveLength(4)
    // It arrives unnamed and opens straight into its field, so the name can be
    // typed without first finding the control that reveals it.
    expect(screen.getAllByLabelText(familyLabel)).toHaveLength(1)
  })

  // DndContext renders no DOM, so without a wrapper the frame and this button
  // are siblings in whatever flex container the caller supplies: the import's
  // shell is items-start and onboarding's is items-center, which left the same
  // control aligned differently on the two surfaces.
  it("puts the frame and add-family in one full-width block", () => {
    const view = render(<Harness />)
    const frame =
      view.container.querySelector("table")?.parentElement?.parentElement
    const addFamily = screen.getByRole("button", { name: t.addFamily })
    expect(frame).toBeTruthy()
    const column = frame?.parentElement
    expect(column?.className).toContain("w-full")
    // Same parent, so neither can drift out of the other's column.
    expect(addFamily.parentElement).toBe(column)
  })

  // Below the frame, not a row of the table: adding a family acts on the whole
  // list rather than on any group, and as a row it read as one more family's
  // own add-role control at the same inset.
  it("keeps add-family outside the table and its frame", () => {
    const view = render(<Harness />)
    const addFamily = screen.getByRole("button", { name: t.addFamily })
    expect(addFamily.closest("table")).toBeNull()
    // Outside the bordered frame too, not merely outside the table: inside it
    // the button would sit against the rules as if it belonged to the last
    // family. Checked against the frame the table actually has, since an
    // ancestor test needs the real element rather than a class guess.
    const frame =
      view.container.querySelector("table")?.parentElement?.parentElement
    expect(frame).toBeTruthy()
    expect(frame?.contains(addFamily)).toBe(false)
  })

  // A group only ever loses the proposed row; it never changes into something
  // else. Taking the last one out leaves the family exactly as the org has it.
  it("keeps a family's group when its last proposed role goes", () => {
    const view = render(<Harness />)
    fireEvent.click(
      screen.getByRole("button", { name: removeRole("Platform Engineer") })
    )
    fireEvent.click(screen.getByRole("button", { name: t.removeRoleConfirm }))
    // Still one tbody per family.
    expect(groups(view.container)).toHaveLength(3)
    expect(screen.getByText("Developer")).toBeTruthy()
  })

  // A new family named after one the org already has merges into it, so that
  // family's own group would sit right beside a group duplicating it, offering
  // a removable menu next to Finance's own name. The group that carries the
  // roles is the honest one; the register's steps aside.
  it("drops the register group for a family a new one already names", async () => {
    const view = render(<Harness />)
    // One tbody per family. Add-family lives below the frame, not in the table.
    expect(groups(view.container)).toHaveLength(3)

    const legal = await openName("Legal")
    fireEvent.change(legal, { target: { value: "  finance  " } })

    // One family group fewer, and exactly one menu naming Finance: the new
    // one's. The match is on the trimmed, case-folded name, exactly as the
    // resolver decides where the roles land.
    expect(groups(view.container)).toHaveLength(2)
    expect(
      screen.getAllByRole("button", { name: familyActions("finance") })
    ).toHaveLength(1)

    // And it comes straight back once the name stops matching.
    fireEvent.change(legal, { target: { value: "Legal" } })
    expect(groups(view.container)).toHaveLength(3)
    expect(screen.getByText("Controller")).toBeTruthy()
  })
})

describe("FamilyReviewTable annotations", () => {
  afterEach(() => {
    cleanup()
  })

  // The AI's own duplicates never reach the draft, so this note only ever
  // marks a title the user typed or dragged into a family that already has it.
  it("notes a duplicate row under its own title field", () => {
    render(
      <Harness
        annotations={{ ...NO_ANNOTATIONS, duplicateRoleIds: new Set([2]) }}
      />
    )
    const row = rowOf(screen.getByDisplayValue("Platform Engineer"))
    expect(within(row).getByText(t.duplicate)).toBeTruthy()
    // Still editable: renaming it is the fix.
    expect(
      (screen.getByDisplayValue("Platform Engineer") as HTMLInputElement)
        .disabled
    ).toBe(false)
  })

  // A titleless row is dropped from the count. Unannotated, the row still sits
  // there looking like a role while the CTA quietly counts one fewer.
  it("notes a blank row", () => {
    render(
      <Harness
        annotations={{ ...NO_ANNOTATIONS, blankRoleIds: new Set([4]) }}
      />
    )
    expect(screen.getByText(t.blankTitle)).toBeTruthy()
  })

  it("shows the collision message on a colliding family", () => {
    render(
      <Harness
        annotations={{ ...NO_ANNOTATIONS, collidingFamilyIds: new Set([3]) }}
      />
    )
    expect(screen.getByText(t.collision)).toBeTruthy()
  })

  // A family with real roles but no name would otherwise have those roles
  // dropped silently on create; this message is what tells the user before
  // that happens.
  it("shows the nameMissing message on a family flagged as missing a name", () => {
    render(
      <Harness
        annotations={{ ...NO_ANNOTATIONS, nameMissingFamilyIds: new Set([3]) }}
      />
    )
    expect(screen.getByText(t.nameMissing)).toBeTruthy()
  })

  it("shows no note when nothing is annotated", () => {
    render(<Harness />)
    expect(screen.queryByText(t.duplicate)).toBeNull()
    expect(screen.queryByText(t.blankTitle)).toBeNull()
    expect(screen.queryByText(t.collision)).toBeNull()
    expect(screen.queryByText(t.nameMissing)).toBeNull()
  })
})
