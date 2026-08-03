"use client"

import { DndContext, DragOverlay, useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Add01Icon,
  DragDropVerticalIcon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { MAX_FAMILY_NAME, MAX_ROLE_TITLE } from "@workspace/constants"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import { type FocusEvent, useEffect, useRef, useState } from "react"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { RemoveConfirm } from "@/components/remove-confirm"
import { TrackBadge } from "@/components/track-badge"
import { useFamilyDnd } from "@/hooks/use-family-dnd"
import type { DraftFamily, DraftRole } from "@/lib/family-dnd"
import {
  FAMILY_COUNT_CLASS,
  FAMILY_NAME_CLASS,
  FAMILY_ROW_CLASS,
} from "@/lib/role-family-row"
import { onSelectValue } from "@/lib/select"

interface TrackOption {
  trackKey: string
  label: string
}

type FamiliesUpdater = (current: DraftFamily[]) => DraftFamily[]

// Four columns, every row: the drag handle, the title, the track, and the
// remove control. A static row leaves the first and last EMPTY rather than
// dropping them, so both row types put the title and the track on the same
// x-position and the group reads as one table instead of two interleaved ones.
// Declared once, because the group header and the add row span it.
const COLUMN_COUNT = 4

// Width classes stated once and shared by the header and the body, so a column
// cannot be widened in one place and not the other. The track fits the widest
// track name; the title column takes whatever is left. Each control column is
// its own control's size-9 square plus a gutter on the side facing the data
// columns (pr on the handle, pl on the remove), flush (no padding) on the side
// facing the row's own outer edge. Without that gutter the remove control sat
// close enough against the track select to read as drawn inside it.
const HANDLE_CELL = "w-12 pr-3 pl-0"
const TRACK_CELL = "w-48"
const REMOVE_CELL = "w-12 pl-3 pr-0"

// The family header carries NO padding override. A group header is a one-line
// label, and it once stood three times a role row's height because a
// full-height control sat in a cell that already had padding; this view can
// hold forty of them. What keeps it short is that everything in it is sized
// not to inflate it (the row-actions trigger is size-6), so the cell's own
// default box already fits. A py- on one cell would set the whole row's
// height by itself, which is why there is none on any of them.

// Annotations derived per render by resolveImportTargets and passed in, so this
// stays a view over the resolved draft and cannot reach a different verdict
// than the CTA does. Ids only: the wording is this surface's own and is read
// from i18n here.
export interface ReviewAnnotations {
  collidingFamilyIds: ReadonlySet<number>
  // A family holding real roles but no name. Its roles would otherwise be
  // dropped silently, so the review says so and blocks creating.
  nameMissingFamilyIds: ReadonlySet<number>
  // A title the target family already holds. The AI's own duplicates never
  // reach the draft (buildImportSeed drops them), so this only ever marks a
  // title the user typed or dragged into a family that already has it.
  duplicateRoleIds: ReadonlySet<number>
  // Rows with no title. They are dropped from the count, and an unannotated
  // row leaves the count quietly disagreeing with what is on screen.
  blankRoleIds: ReadonlySet<number>
}

// One role the org already has, as its read-only row shows it. The track
// travels as both key and name because the row renders it as a TrackBadge: the
// key picks the tint, the name is what the badge reads.
export interface RegisterRole {
  id: string
  title: string
  trackKey: string
  trackName: string
}

// A family the org already has, keyed by its real id in the register below.
export interface RegisterFamily {
  roles: readonly RegisterRole[]
}

// The organization's existing register.
//
// A family group is register-backed when the DRAFT carries the real familyId
// the seed put on it, never when the typed name happens to match: identity that
// moved while the user typed would make controls appear and vanish
// mid-keystroke. That is also what makes the additive invariant safe to state,
// since everything removable on this screen is then something that does not
// exist yet.
export type ReviewRegister = ReadonlyMap<string, RegisterFamily>

// The defaults for a surface with no register behind it and nothing to warn
// about. Module constants rather than inline literals, so a fresh identity per
// render cannot invalidate anything downstream that keys on them.
const EMPTY_REGISTER: ReviewRegister = new Map()
const NO_ANNOTATIONS: ReviewAnnotations = {
  collidingFamilyIds: new Set(),
  nameMissingFamilyIds: new Set(),
  duplicateRoleIds: new Set(),
  blankRoleIds: new Set(),
}

// A group that will actually be drawn, with the register entry behind it
// already resolved.
interface VisibleFamily {
  family: DraftFamily
  registerFamily: RegisterFamily | null
}

const norm = (value: string) => value.trim().toLowerCase()

// The role import's review: the organization's whole register as ONE grouped
// table inside ONE bordered frame, with the roles this import would add
// editable rows in the family they are going to.
//
// Shaped after the roles register (components/roles/roles-table.tsx) rather
// than after a card grid, because that is the page the user already
// knows their roles from and this is the same content: every family, every
// role. Like that register it is grouped and therefore unsorted (the grouping
// IS the order), and unlike it there is no pagination and no search toolbar:
// this is a bounded proposal to read once and confirm, not a register to
// browse, and a review that hid rows behind a pager could confirm rows the user
// never saw.
//
// What separates the two row types is that a role the family already has
// carries no control at all. The confirm can only ADD, so a field there would
// take an edit and silently discard it, and a remove control would confirm,
// empty the row off the screen and change nothing.
export function FamilyReviewTable({
  families,
  onFamiliesChange,
  claimId,
  trackOptions,
  annotations = NO_ANNOTATIONS,
  register = EMPTY_REGISTER,
}: {
  families: DraftFamily[]
  onFamiliesChange: (updater: FamiliesUpdater) => void
  claimId: () => number
  trackOptions: TrackOption[]
  // Both default to empty, which is exactly onboarding's case: it builds a
  // starter set for an org that has no register yet, so every family and every
  // role in the draft is one this flow would create and is therefore editable
  // and removable. The read-only rows and the warnings are what the in-app
  // import adds on top, by passing a register and a resolver's verdict.
  annotations?: ReviewAnnotations
  register?: ReviewRegister
}) {
  const t = useTranslations("dashboard.familyTable")

  const { dndContextProps, activeRole } = useFamilyDnd({
    families,
    onFamiliesChange,
  })

  // A register family's own group steps aside only while another group claims
  // its name; identity must not change while a name is being typed.
  function registerFamilyOf(family: DraftFamily): RegisterFamily | null {
    if (family.familyId === undefined) return null
    return register.get(family.familyId) ?? null
  }

  // The names claimed by families this import would CREATE. Identity is derived
  // from the name for those, so one named after a family the org already has
  // merges into it, and the org's own group would then sit beside a group that
  // duplicates it, carrying a remove control that names that family. That is
  // the exact misreading the additive invariant exists to prevent. The group
  // holding the roles is the honest representation, so the register's own group
  // steps aside while the name matches and comes back the moment it stops.
  const claimedNames = new Set<string>()
  for (const family of families) {
    if (family.familyId !== undefined) continue
    const name = norm(family.name)
    if (name !== "") claimedNames.add(name)
  }

  const visible: VisibleFamily[] = []
  for (const family of families) {
    const registerFamily = registerFamilyOf(family)
    // Superseded by a group that names this family: the resolver merges the
    // two, so two groups would claim one name. Only ever the group that carries
    // nothing of its own, because hiding one holding proposed rows would take
    // those rows off the screen while still submitting them.
    if (
      registerFamily !== null &&
      family.roles.length === 0 &&
      claimedNames.has(norm(family.name))
    ) {
      continue
    }
    visible.push({ family, registerFamily })
  }

  function updateFamily(familyId: number, patch: Partial<DraftFamily>) {
    onFamiliesChange((current) =>
      current.map((family) =>
        family.id === familyId ? { ...family, ...patch } : family
      )
    )
  }

  return (
    <DndContext {...dndContextProps}>
      {/* This component owns its own column. DndContext renders no DOM, so
          without a wrapper the frame and the Add-family button are siblings in
          whatever flex container the caller provides: the import's shell is
          items-start and onboarding's is items-center, which left the same
          button aligned differently on the two surfaces. */}
      <div className="w-full space-y-4">
        {/* A plain bordered container rather than a Card. A table wants its own
            rules to meet the frame on all four sides, so a Card here has to give
            up its padding, its gap and its shadow to hold one, and what is left
            of it is a border. overflow-hidden is what lets the header fill and
            the family bands run edge to edge without squaring off the corners. */}
        <div className="w-full overflow-hidden rounded-lg border">
          {/* table-fixed with the widths declared on the header: auto layout
              re-measures columns from their content, so a title typed into any
              row would shift the track and the controls of every other row
              while it was being typed. */}
          <Table className="table-fixed">
            {/* The two data columns are labelled on screen; the two control
                  columns carry their name for assistive tech only, since a
                  heading over a drag handle or a remove control would be a word
                  spent on chrome.
                  Every cell stays IN FLOW, including the sr-only ones, because
                  table-fixed takes its column widths from the first row: pulled
                  out of flow with sr-only on the cell itself, every width below
                  would re-measure from whatever the first family group happened
                  to hold. The sr-only sits on a span INSIDE the cell. */}
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={HANDLE_CELL}>
                  <span className="sr-only">{t("columnMove")}</span>
                </TableHead>
                <TableHead>{t("columnRole")}</TableHead>
                <TableHead className={TRACK_CELL}>{t("columnTrack")}</TableHead>
                <TableHead className={REMOVE_CELL}>
                  <span className="sr-only">{t("columnRemove")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            {visible.map(({ family, registerFamily }, index) => (
              <FamilyGroup
                key={family.id}
                family={family}
                registerFamily={registerFamily}
                trackOptions={trackOptions}
                annotations={annotations}
                onUpdate={(patch) => updateFamily(family.id, patch)}
                onRemove={() =>
                  onFamiliesChange((current) =>
                    current.filter((item) => item.id !== family.id)
                  )
                }
                claimId={claimId}
                isLast={index === visible.length - 1}
              />
            ))}
          </Table>
        </div>
        {/* Below the table, not inside it: adding a family is an action on
            the whole list rather than a row of it, and as a table row it read as
            one more family's own add-role control sitting at the same inset. It
            is also deliberately outside every droppable, so it can never absorb
            a drop meant for a family. */}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onFamiliesChange((current) => [
              ...current,
              { id: claimId(), name: "", roles: [] },
            ])
          }
        >
          <HugeiconsIcon icon={Add01Icon} aria-hidden="true" />
          {t("addFamily")}
        </Button>
      </div>
      <DragOverlay>
        {activeRole !== null && (
          <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
            {activeRole.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// One family: its own <tbody>, which is both the group and the drop target.
// A tbody is a real element with a box, so it can carry the droppable ref
// directly and a drop anywhere in the group (including on the roles the family
// already has, and on the header of a family with nothing proposed for it)
// lands in that family.
function FamilyGroup({
  family,
  registerFamily,
  trackOptions,
  annotations,
  onUpdate,
  onRemove,
  claimId,
  isLast,
}: {
  family: DraftFamily
  registerFamily: RegisterFamily | null
  trackOptions: TrackOption[]
  annotations: ReviewAnnotations
  onUpdate: (patch: Partial<DraftFamily>) => void
  onRemove: () => void
  claimId: () => number
  // The table's final group, whose last row keeps the vendor's border-0: a
  // rule there would double up against the frame's own bottom edge.
  isLast: boolean
}) {
  const t = useTranslations("dashboard.familyTable")
  const tFamily = useTranslations("dashboard.roles.family")
  const { setNodeRef, isOver } = useDroppable({ id: `family-${family.id}` })

  // Everything this import would CREATE can be renamed and removed; a family
  // the org already has can only be added to. That is the whole screen's rule:
  // the only action offered on something that already exists is an additive
  // one, so a menu can never confirm a change it has no way to perform.
  const created = registerFamily === null

  // A family added by hand arrives unnamed and opens straight into its field,
  // so the name can be typed without hunting for the control that reveals it.
  // A family the AI proposed arrives named and opens only when asked.
  const [editing, setEditing] = useState(created && family.name === "")
  const [confirmRemove, setConfirmRemove] = useState(false)
  // Rename was chosen and the menu is still closing. The field cannot open on
  // the click itself: a menu moves focus as it closes (through the body on the
  // way back to its trigger), which blurs a field opened in the same tick, and
  // this field closes on blur. So the choice is recorded and the field opens
  // once the menu is done, with nothing left to take the caret off it.
  const [renamePending, setRenamePending] = useState(false)
  const headerRowRef = useRef<HTMLTableRowElement>(null)
  const nameFieldRef = useRef<HTMLInputElement>(null)
  // autoFocus fires on mount, which is BEFORE the menu's focus restore, so the
  // caret ends up on the trigger and the field sits open with nothing in it.
  // The blur guard below keeps the field alive through that; this claims the
  // caret back afterwards, so Rename lands where the gesture asked it to.
  useEffect(() => {
    if (!editing) return
    const frame = requestAnimationFrame(() => nameFieldRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [editing])
  // Closing on blur, EXCEPT when focus lands back inside this family's own
  // header row.
  //
  // The deferral above does not remove the race, because Base UI unmounts the
  // popup and calls onOpenChangeComplete in the same synchronous block: an
  // animation only decides WHEN that block runs, never what runs first. The
  // menu's focus restore is queued as a microtask from a layout-effect
  // cleanup, so it lands after this field has mounted and taken the caret,
  // blurs it, and Rename becomes a no-op that flashes a field and shuts it.
  // That happens for every reader, not only one who prefers reduced motion.
  // The guard makes the ordering stop mattering.
  const onEditDone = (event?: FocusEvent<HTMLInputElement>) => {
    const next = event?.relatedTarget
    if (next instanceof Node && headerRowRef.current?.contains(next) === true) {
      return
    }
    setEditing(false)
  }

  // What the row calls this family, used both as its visible text and inside
  // the menu trigger's accessible name. A family added by hand has no name
  // yet, and an empty accessible name would leave forty identical triggers in
  // a screen reader's element list.
  const displayName =
    family.name.trim() === "" ? tFamily("nameLabel") : family.name

  function addRole() {
    onUpdate({
      roles: [...family.roles, { id: claimId(), title: "", trackKey: "IC" }],
    })
  }

  return (
    <TableBody
      ref={setNodeRef}
      // The whole group tints while it is the drop target: the target of this
      // gesture is the family, not a position in it, so the family is what
      // lights up. On the rows rather than the tbody, which browsers do not
      // paint reliably. Solid rather than the row's own idle bg-muted/50: the
      // header row already carries that idle tint, so a family with nothing
      // proposed (header row only, nothing below it to light up instead) would
      // show no visible change at all while dragged over.
      //
      // The border restore is not cosmetic drift from the vendor: TableBody
      // ships [&_tr:last-child]:border-0, written for a table with ONE tbody,
      // where the only last row is the table's own. This table has a tbody per
      // family, so that rule strips the rule under EVERY family's last row and
      // the next family's header sits straight on top of it. Restored here and
      // dropped again on the final group, whose border would otherwise double
      // up against the frame's own edge.
      className={cn(
        !isLast && "[&_tr:last-child]:border-b",
        isOver && "[&>tr]:bg-muted"
      )}
    >
      <TableRow className={FAMILY_ROW_CLASS} ref={headerRowRef}>
        <TableCell colSpan={COLUMN_COUNT - 1}>
          <div className="min-w-0">
            {/* Every family reads its name as static text, whether the org
                already has it or this import would create it, so the header
                band is one line of text in both cases rather than a field in
                one and a label in the other. The field is what the menu's
                Rename reveals, and only a family this import would create
                offers it: renaming one the org already has would suggest a
                rename this screen cannot perform. */}
            {!editing ? (
              // Name and count laid out exactly as the roles register lays out
              // its own family group row (components/roles/roles-table.tsx),
              // baseline-aligned, from the same shared classes so the two
              // cannot drift (lib/role-family-row.ts). This is the same content
              // as that page, so it should read as the same row. The one
              // deliberate difference is that the register's name
              // is a Link to the family page and this one is not: a wizard is a
              // takeover, and navigating out of it mid-review would discard the
              // whole proposal.
              <span className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "truncate",
                    FAMILY_NAME_CLASS,
                    // A family added by hand and not yet named: something has
                    // to occupy the line, or the row is a blank band with a
                    // control floating in it.
                    family.name.trim() === "" && "font-normal italic"
                  )}
                >
                  {displayName}
                </span>
                {/* Only a family the org already has. The count says what is
                    already in it, which is what the register's count means
                    too; a family this import would create has nothing yet, and
                    a "0" beside its name would read as a fact about the org
                    rather than as the absence of one. The roles being added
                    are the rows directly below either way. */}
                {registerFamily !== null && (
                  <span className={cn("shrink-0", FAMILY_COUNT_CLASS)}>
                    {tFamily("roleCount", {
                      count: registerFamily.roles.length,
                    })}
                  </span>
                )}
              </span>
            ) : (
              <Input
                aria-label={tFamily("nameLabel")}
                ref={nameFieldRef}
                value={family.name}
                // Opened by the menu's Rename or by being added, so the caret
                // belongs in it without a second click. The field only exists
                // once deliberately opened, so it never steals focus on load.
                autoFocus
                // The server rejects the WHOLE payload over one overlong
                // name, with no way to point at the offending family, so
                // the field cannot accept more than the write will take.
                maxLength={MAX_FAMILY_NAME}
                // h-7 against the h-9 default: the field sets the header's
                // height, and at the default this one row outgrew every
                // role row beneath it.
                className="h-7 max-w-xs font-medium"
                onChange={(event) => onUpdate({ name: event.target.value })}
                onBlur={onEditDone}
                onKeyDown={(event) => {
                  // Enter and Escape both just close the field: the name
                  // is already committed on every keystroke, so there is
                  // no draft to keep or discard, only a field to put away.
                  if (event.key === "Enter" || event.key === "Escape") {
                    event.preventDefault()
                    onEditDone()
                  }
                }}
              />
            )}
            {/* Outside the editing branch: a name that collides or is
                missing is still wrong once the field is closed, and an alert
                that disappeared with the field would take the only
                explanation of a blocked Create with it. */}
            {annotations.collidingFamilyIds.has(family.id) && (
              <p
                role="alert"
                className="mt-1.5 whitespace-normal text-destructive text-sm"
              >
                {t("collision")}
              </p>
            )}
            {annotations.nameMissingFamilyIds.has(family.id) && (
              <p
                role="alert"
                className="mt-1.5 whitespace-normal text-destructive text-sm"
              >
                {t("nameMissing")}
              </p>
            )}
          </div>
        </TableCell>
        {/* One trailing menu, in the same column as every role row's own remove
            control, so the family's actions sit on the table's grid instead of
            floating at the right of a wide band where they read as belonging to
            the Track column above them. Three separate controls crowded beside
            a short name is exactly the shape this repo's row-actions convention
            exists for.
            A family the org already has still gets the menu, holding Add role
            alone: the trigger is then identical in every group, so the eye
            reads one rhythm down the right edge and nothing shifts between the
            two family types. What differs is what the menu contains, which is
            where the difference actually lives. */}
        <TableCell className={REMOVE_CELL}>
          <div className="flex justify-end">
            {/* The trigger is icon-xs, not the icon default the convention
                normally takes: a size-9 trigger is precisely what once ran this
                one-line band to three times a role row's height. Centred in a
                size-9-wide slot so its glyph still lands on the same vertical
                line as the size-9 remove control of every role row below. */}
            <span className="flex w-9 justify-center">
              <DropdownMenu
                // Opening the menu puts any open name field away. The blur
                // guard below deliberately ignores focus moving to this
                // trigger, so without this the field opened by Rename would
                // stay open for good once the user reached for the menu again:
                // no further blur can fire on an input that never regains
                // focus. This is also the gesture that means "I want the menu,
                // not the field".
                onOpenChange={(open) => {
                  if (open) setEditing(false)
                }}
                // The field Rename asks for opens here, once the menu is
                // fully closed and has finished moving focus, rather than in
                // the item's own click.
                onOpenChangeComplete={(open) => {
                  if (open || !renamePending) return
                  setRenamePending(false)
                  setEditing(true)
                }}
              >
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      // The menu repeats once per family, so its accessible
                      // name carries the family: forty identical triggers are
                      // indistinguishable in a screen reader's element list.
                      aria-label={t("familyActions", { name: displayName })}
                      className="text-muted-foreground hover:text-foreground"
                    />
                  }
                >
                  <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* Additive, so it is offered on every family: adding a role
                      to a family the org already has is the whole feature. */}
                  <DropdownMenuItem onClick={addRole}>
                    {t("addRoleShort")}
                  </DropdownMenuItem>
                  {created && (
                    <DropdownMenuItem onClick={() => setRenamePending(true)}>
                      {tFamily("renameCta")}
                    </DropdownMenuItem>
                  )}
                  {created && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setConfirmRemove(true)}
                    >
                      {tFamily("removeCta")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
            {/* An AlertDialog rather than the inline RemoveConfirm morph: the
                menu closes as the item is chosen, so there is no trigger left
                in the row for a morph confirm to expand out of, and its own
                slot is a size-9 square, the height this band cannot afford.
                Renders through a portal, so nothing of it sits in this cell. */}
            <ConfirmDeleteDialog
              open={confirmRemove}
              onOpenChange={setConfirmRemove}
              title={t("removeFamilyTitle")}
              // Which warning is true depends on whether anything in this
              // group EXISTS, not on which surface is asking. Onboarding's
              // template path writes the starter set on pick, before this
              // review, and a revisit resumes an existing set, so removing a
              // written group there is a destructive reconcile that archives
              // its roles; telling that user "nothing in your register
              // changes" would promise the opposite of what Next does.
              //
              // The group's own id is not enough to tell them apart.
              // Onboarding's resume seed collects every role that has no
              // family into ONE synthetic group (use-families-draft-flow.ts):
              // it carries no familyId, because no such family exists, yet
              // every role in it is real and reconcile will archive the lot.
              // So the question is whether anything here has been written at
              // all, which is the family's id OR any role's.
              description={
                family.familyId === undefined &&
                !family.roles.some((role) => role.roleId !== undefined)
                  ? t("removeFamilyDescription")
                  : t("removeFamilyDescriptionExisting")
              }
              confirmLabel={t("removeFamilyConfirm")}
              cancelLabel={tFamily("cancel")}
              onConfirm={onRemove}
            />
          </div>
        </TableCell>
      </TableRow>

      {/* What the family already holds comes first, so the group reads as the
          family as it stands plus what is being added to it. */}
      {registerFamily?.roles.map((role) => (
        <RegisterRoleRow
          key={role.id}
          title={role.title}
          trackKey={role.trackKey}
          trackName={role.trackName}
        />
      ))}

      <SortableContext
        items={family.roles.map((role) => `role-${role.id}`)}
        strategy={verticalListSortingStrategy}
      >
        {family.roles.map((role) => (
          <SortableRoleRow
            key={role.id}
            role={role}
            trackOptions={trackOptions}
            // One note slot per row: a row is either already taken or empty,
            // never both (an empty title cannot collide).
            note={
              annotations.duplicateRoleIds.has(role.id)
                ? t("duplicate")
                : annotations.blankRoleIds.has(role.id)
                  ? t("blankTitle")
                  : null
            }
            onTitleChange={(title) =>
              onUpdate({
                roles: family.roles.map((item) =>
                  item.id === role.id ? { ...item, title } : item
                ),
              })
            }
            onTrackChange={(trackKey) =>
              onUpdate({
                roles: family.roles.map((item) =>
                  item.id === role.id ? { ...item, trackKey } : item
                ),
              })
            }
            onRemove={() =>
              onUpdate({
                roles: family.roles.filter((item) => item.id !== role.id),
              })
            }
          />
        ))}
      </SortableContext>
    </TableBody>
  )
}

// A role the family already holds. The same four columns as a proposed row, but
// static muted text instead of an Input and a Select, and the handle's and the
// remove control's cells left empty: the import cannot rename, re-track or
// delete an existing role, and a control that silently discards what it is
// given is worse than no control at all. Not draggable either, since moving a
// role between families is a mutation this screen cannot perform.
function RegisterRoleRow({
  title,
  trackKey,
  trackName,
}: {
  title: string
  trackKey: string
  trackName: string
}) {
  return (
    <TableRow className="text-muted-foreground">
      <TableCell className={HANDLE_CELL} />
      <TableCell>
        <span className="block truncate">{title}</span>
      </TableCell>
      <TableCell className={TRACK_CELL}>
        {/* Block flex wrapper: an inline-flex badge sitting directly on the
            cell's text baseline inflates the line box by a font-metric-
            dependent amount, which would leave this row a hair taller than the
            static rows around it. */}
        <div className="flex items-center">
          {/* The full track name, not the short key: the editable row beside it
              shows the same names in its Select, and the column is sized for
              them, so an abbreviation here would have the two row types naming
              the same thing differently in one column. */}
          <TrackBadge trackKey={trackKey} name={trackName} />
        </div>
      </TableCell>
      <TableCell className={REMOVE_CELL} />
    </TableRow>
  )
}

// A role this import would add: editable, removable and draggable into another
// family.
function SortableRoleRow({
  role,
  trackOptions,
  note,
  onTitleChange,
  onTrackChange,
  onRemove,
}: {
  role: DraftRole
  trackOptions: TrackOption[]
  // Why this row will not be created as written (already taken, or empty).
  note: string | null
  onTitleChange: (title: string) => void
  onTrackChange: (trackKey: string) => void
  onRemove: () => void
}) {
  const t = useTranslations("dashboard.familyTable")
  const tCreate = useTranslations("dashboard.roles.create")
  const tFamily = useTranslations("dashboard.roles.family")
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `role-${role.id}` })

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
    >
      <TableCell className={HANDLE_CELL}>
        <Button
          type="button"
          ref={setActivatorNodeRef}
          variant="ghost"
          size="icon"
          className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          aria-label={t("dragHandle", { title: role.title })}
          {...attributes}
          {...listeners}
        >
          <HugeiconsIcon icon={DragDropVerticalIcon} aria-hidden="true" />
        </Button>
      </TableCell>
      <TableCell>
        <Input
          aria-label={tCreate("titleLabel")}
          value={role.title}
          // Matches the family name: an overlong title rejects the whole import
          // server-side, and the review cannot point at the row that did it.
          maxLength={MAX_ROLE_TITLE}
          onChange={(event) => onTitleChange(event.target.value)}
        />
        {/* Under the field it is about, following the FormMessage precedent.
            It extends the row downwards and moves nothing already on screen. */}
        {note !== null && (
          <p className="mt-1 whitespace-normal text-muted-foreground text-xs">
            {note}
          </p>
        )}
      </TableCell>
      <TableCell className={TRACK_CELL}>
        <Select
          value={role.trackKey}
          onValueChange={onSelectValue(onTrackChange)}
          items={trackOptions.map((option) => ({
            value: option.trackKey,
            label: option.label,
          }))}
        >
          <SelectTrigger aria-label={tCreate("trackLabel")} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {trackOptions.map((option) => (
              <SelectItem key={option.trackKey} value={option.trackKey}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className={REMOVE_CELL}>
        {/* Flex wrapper: see the family header's remove cell for why a bare
            RemoveConfirm cannot sit directly in a table cell. */}
        <div className="flex justify-end">
          <RemoveConfirm
            triggerLabel={t("removeRole", { title: role.title })}
            confirmLabel={t("removeRoleConfirm")}
            cancelLabel={tFamily("cancel")}
            onConfirm={onRemove}
          />
        </div>
      </TableCell>
    </TableRow>
  )
}
