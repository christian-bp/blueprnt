# Import Upload Step on Attachment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two hand-rolled file cards in the people-import upload step with the vendored `Attachment` component, and give a rejected file its own card naming the file that failed.

**Architecture:** One file changes: `apps/dashboard/components/people/import/upload-step.tsx`. Its two duplicated card shells collapse into a single `Attachment` whose `state` comes from a typed discriminated union derived from state the component already tracks (`reading`, `error`, `parsed`/`fileName`). Task 1 moves the uploading and done cards over, leaving the error path untouched. Task 2 adds a `rejected` filename to state and moves the error onto the same card. No new files, no new i18n keys, no backend change.

**Tech Stack:** Next.js 16 client component, `@workspace/ui/components/attachment` (vendored shadcn, Base UI), `next-intl`, Vitest 4 + @testing-library/react.

## Global Constraints

- `packages/ui/src/components/attachment.tsx` is vendor code and MUST NOT be modified. All adaptation happens at the call site.
- No new i18n keys. Reuse `dashboard.people.import.upload.*`: `uploading`, `detected`, `removeFile`, `errorEmpty`, `errorNotCsv`, `errorInvalidFormat`.
- The exported pure helpers `handleCsvText`, `isOle2Signature`, `formatFileSize` MUST keep their current signatures and behaviour; their tests must not change.
- The props contract with `import-wizard.tsx` (`parsed`, `fileName`, `fileSize`, `onParsed`, `onClear`) MUST NOT change.
- Never run `bun test` (Bun hijacks it). Always `bun run test`, or `bunx vitest run <file>` inside `apps/dashboard`.
- Do not widen a type to `any`. The card descriptor is a discriminated union so a missing field is a compile error.
- No em dashes in code comments or copy.

---

## File Structure

- **Modify:** `apps/dashboard/components/people/import/upload-step.tsx` — the only production file. Gains the `Attachment` imports, a typed `card` descriptor replacing the `showCompleted` boolean, a `rejected` state field, and a `fail` helper. Loses the `Button` import and ~55 lines of duplicated card markup.
- **Modify:** `apps/dashboard/components/people/import/upload-step.test.tsx` — Task 2 adds three cases. Tasks must not weaken existing assertions.

Note on test coverage: there is **no existing test for the uploading card** (asserting it would require stubbing `FileReader` mid-read, which is out of scope). Task 1 is therefore guarded by the done-card tests, the error tests, the "no summary before parse" test, and the two `ImportWizard` gating tests, plus typecheck.

---

### Task 1: Move the uploading and done cards onto Attachment

**Files:**
- Modify: `apps/dashboard/components/people/import/upload-step.tsx:1-12` (imports), `:149-150` (derivation), `:162-219` (the two cards)
- Test: `apps/dashboard/components/people/import/upload-step.test.tsx` (no changes; it is the safety net)

**Interfaces:**
- Consumes: `Attachment`, `AttachmentMedia`, `AttachmentContent`, `AttachmentTitle`, `AttachmentDescription`, `AttachmentActions`, `AttachmentAction` from `@workspace/ui/components/attachment`.
- Produces: a local `type UploadCard` discriminated union and a `card: UploadCard | null` value. Task 2 extends this union with an `error` arm, so keep the type declaration at module scope inside the file, directly above `UploadStep`.

- [ ] **Step 1: Establish the green baseline**

Run: `cd apps/dashboard && bunx vitest run components/people/import/upload-step.test.tsx`
Expected: PASS, 18 tests. If it does not pass, stop: something else is broken and this refactor would mask it.

- [ ] **Step 2: Update the imports**

Replace lines 1-12 of `upload-step.tsx` with:

```tsx
"use client"

import { Cancel01Icon, Csv01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ImportFormatError, tokenizeCsv } from "@workspace/import"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@workspace/ui/components/attachment"
import { Progress } from "@workspace/ui/components/progress"
import { Spinner } from "@workspace/ui/components/spinner"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { FileDropzone } from "@/components/file-dropzone"
import type { ParsedCsv } from "./import-wizard"
```

The `Button` import is deliberately gone: `AttachmentAction` is already a ghost icon `Button`. `Alert02Icon` is NOT added yet, it arrives with the error arm in Task 2.

- [ ] **Step 3: Add the card descriptor type**

Insert directly above `export function UploadStep(` (i.e. above what is currently line 72):

```tsx
// What the file card shows, per state. A discriminated union rather than a set
// of loose booleans, so the state, its test hook and its copy cannot drift
// apart, and a missing field is a compile error. Exactly one card renders at a
// time: the branches below are mutually exclusive by construction.
type UploadCard =
  | {
      state: "uploading"
      testId: "uploading-file"
      title: string
      description: string
      progress: number
    }
  | {
      state: "done"
      testId: "detected-summary"
      title: string
      description: string
    }
```

- [ ] **Step 4: Replace the `showCompleted` boolean with the card descriptor**

Delete the current lines 149-150:

```tsx
  const showCompleted =
    parsed !== null && fileName !== null && reading === null && error === null
```

and put in their place:

```tsx
  // A read in flight wins, otherwise a parsed file with no error. Checking
  // `parsed` and `fileName` inline (rather than via a precomputed boolean) is
  // what narrows them to non-null for the done arm. The `error === null` guard
  // is the one `showCompleted` used to carry.
  const card: UploadCard | null =
    reading !== null
      ? {
          state: "uploading",
          testId: "uploading-file",
          title: reading.name,
          description: t("uploading", { progress: reading.progress }),
          progress: reading.progress,
        }
      : error === null && parsed !== null && fileName !== null
        ? {
            state: "done",
            testId: "detected-summary",
            title: fileName,
            description: `${
              fileSize !== null ? `${formatFileSize(fileSize)} · ` : ""
            }${t("detected", {
              rows: parsed.rows.length,
              columns: parsed.headers.length,
            })}`,
          }
        : null
```

Task 2 inserts a third branch here for the error state, which is why the done arm carries its own `error === null` guard for now.

- [ ] **Step 5: Replace both card blocks with one Attachment**

Delete everything from the `{/* Uploading card ... */}` comment through the closing `)}` of the completed-file block (currently lines 162-219), and put in its place:

```tsx
      {card !== null && (
        <Attachment
          state={card.state}
          className="w-full"
          data-testid={card.testId}
        >
          <AttachmentMedia>
            {card.state === "uploading" ? (
              <Spinner />
            ) : (
              <HugeiconsIcon
                icon={Csv01Icon}
                size={20}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            )}
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{card.title}</AttachmentTitle>
            <AttachmentDescription>{card.description}</AttachmentDescription>
          </AttachmentContent>
          {card.state === "done" && (
            <AttachmentActions>
              <AttachmentAction
                onClick={onClear}
                aria-label={t("removeFile", { file: card.title })}
                data-testid="remove-file"
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              </AttachmentAction>
            </AttachmentActions>
          )}
          {/* basis-full: the Attachment root is flex-wrap, so this puts the bar
              on its own row inside the card instead of below it. */}
          {card.state === "uploading" && (
            <Progress value={card.progress} className="basis-full" />
          )}
        </Attachment>
      )}
```

Leave the inline error paragraph (currently lines 222-226) exactly as it is. Task 2 removes it.

- [ ] **Step 6: Run the tests**

Run: `cd apps/dashboard && bunx vitest run components/people/import/upload-step.test.tsx`
Expected: PASS, 18 tests, unchanged. In particular `shows the uploaded file card with name, size, and detected shape`, `clears the uploaded file via the remove button`, and both `ImportWizard` gating tests must still pass, since they key off `detected-summary` and `remove-file`.

- [ ] **Step 7: Typecheck**

Run: `bun run typecheck`
Expected: 9/9 tasks successful. A failure here most likely means `card.progress` was read outside the `card.state === "uploading"` branch (the union does not carry it elsewhere).

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/components/people/import/upload-step.tsx
git commit -m "refactor(import): render the upload file card with Attachment"
```

---

### Task 2: Give a rejected file its own error card

**Files:**
- Modify: `apps/dashboard/components/people/import/upload-step.tsx` (imports, the `UploadCard` union, `processFile`, the render)
- Test: `apps/dashboard/components/people/import/upload-step.test.tsx`

**Interfaces:**
- Consumes: `UploadCard` and `card` from Task 1.
- Produces: nothing consumed by later tasks. This is the final task.

- [ ] **Step 1: Write the failing tests**

Add these three cases inside the existing `describe("UploadStep component", ...)` block in `upload-step.test.tsx`, after the `shows errorEmpty when an empty CSV file is selected` test:

```tsx
  it("names the rejected file in an error card", async () => {
    renderUploadStep()

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const file = new File(["<html></html>"], "report.html", {
      type: "text/html",
    })
    Object.defineProperty(input, "files", { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.queryByTestId("rejected-file")).not.toBeNull()
    })
    const card = screen.getByTestId("rejected-file")
    expect(card.textContent).toContain("report.html")
    expect(card.textContent).toContain(m.upload.errorNotCsv)
  })

  it("still announces the rejection to assistive tech", async () => {
    renderUploadStep()

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const file = new File([""], "empty.csv", { type: "text/csv" })
    Object.defineProperty(input, "files", { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        m.upload.errorEmpty
      )
    })
  })

  it("clears the error card when a valid file is picked next", async () => {
    renderUploadStep()

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const bad = new File(["<html></html>"], "report.html", {
      type: "text/html",
    })
    Object.defineProperty(input, "files", { value: [bad], configurable: true })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.queryByTestId("rejected-file")).not.toBeNull()
    })

    const good = new File([FIXTURE_CSV], "payroll.csv", { type: "text/csv" })
    Object.defineProperty(input, "files", { value: [good], configurable: true })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.queryByTestId("rejected-file")).toBeNull()
    })
  })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/dashboard && bunx vitest run components/people/import/upload-step.test.tsx`
Expected: FAIL. `names the rejected file in an error card` and `clears the error card when a valid file is picked next` fail because no element has `data-testid="rejected-file"` yet. `still announces the rejection to assistive tech` PASSES already (the old `<p role="alert">` satisfies it); it is here as the regression guard for Step 5, which deletes that paragraph.

- [ ] **Step 3: Add the error arm and the rejected-file state**

Add `Alert02Icon` to the hugeicons import (alphabetical):

```tsx
import { Alert02Icon, Cancel01Icon, Csv01Icon } from "@hugeicons/core-free-icons"
```

Extend the `UploadCard` union with a third arm:

```tsx
  | {
      state: "error"
      testId: "rejected-file"
      title: string
      description: string
    }
```

Add the state field next to the existing `error` state:

```tsx
  // Name of the file that was refused, so the error card can say which file it
  // was. Held separately from `error` because the failure can happen before any
  // read starts, so `reading` is not set on these paths.
  const [rejected, setRejected] = useState<{ name: string } | null>(null)
```

- [ ] **Step 4: Route every failure through one helper**

Add this helper inside `UploadStep`, directly above `processFile`:

```tsx
  // Every rejection records the offending file's name alongside the code, so
  // the card can name it. One helper rather than four call sites setting two
  // pieces of state each.
  function fail(
    file: File,
    code: "errorEmpty" | "errorNotCsv" | "errorInvalidFormat"
  ) {
    setRejected({ name: file.name })
    setError(code)
  }
```

Then rewrite `processFile` to use it, and to clear `rejected` on the success paths:

```tsx
  async function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      fail(file, "errorNotCsv")
      return
    }
    setError(null)
    setRejected(null)
    const head = new Uint8Array(
      await file.slice(0, OLE2_MAGIC.length).arrayBuffer()
    )
    if (isOle2Signature(head)) {
      fail(file, "errorInvalidFormat")
      return
    }
    setReading({ name: file.name, size: file.size, progress: 0 })
    const reader = new FileReader()
    reader.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        const progress = Math.round((e.loaded / e.total) * 100)
        setReading((prev) => (prev === null ? prev : { ...prev, progress }))
      }
    }
    reader.onerror = () => {
      setReading(null)
      fail(file, "errorEmpty")
    }
    reader.onload = () => {
      setReading(null)
      const text = typeof reader.result === "string" ? reader.result : ""
      const result = handleCsvText(text)
      if (result.ok) {
        setError(null)
        setRejected(null)
        onParsed(result.parsed, text, { name: file.name, size: file.size })
      } else {
        fail(file, result.error)
      }
    }
    reader.readAsText(file)
  }
```

Keep the two OLE2 comments (currently above `OLE2_MAGIC`) and the `processFile` lead comment as they are.

- [ ] **Step 5: Render the error arm and delete the paragraph**

In the `card` descriptor, insert the error branch between the uploading and done branches:

```tsx
  const card: UploadCard | null =
    reading !== null
      ? {
          state: "uploading",
          testId: "uploading-file",
          title: reading.name,
          description: t("uploading", { progress: reading.progress }),
          progress: reading.progress,
        }
      : error !== null
        ? {
            state: "error",
            testId: "rejected-file",
            title: rejected?.name ?? "",
            description: t(error),
          }
        : parsed !== null && fileName !== null
          ? {
              state: "done",
              testId: "detected-summary",
              title: fileName,
              description: `${
                fileSize !== null ? `${formatFileSize(fileSize)} · ` : ""
              }${t("detected", {
                rows: parsed.rows.length,
                columns: parsed.headers.length,
              })}`,
            }
          : null
```

Note the done arm no longer needs its own `error === null` check: the error branch above it already claimed that case.

In the media slot, add the error icon (no colour class: `AttachmentMedia` tints itself under `state="error"`):

```tsx
          <AttachmentMedia>
            {card.state === "uploading" ? (
              <Spinner />
            ) : card.state === "error" ? (
              <HugeiconsIcon
                icon={Alert02Icon}
                strokeWidth={2}
                aria-hidden="true"
              />
            ) : (
              <HugeiconsIcon
                icon={Csv01Icon}
                size={20}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            )}
          </AttachmentMedia>
```

Put the alert role on the description so the rejection is still announced:

```tsx
            <AttachmentDescription
              role={card.state === "error" ? "alert" : undefined}
            >
              {card.description}
            </AttachmentDescription>
```

Then DELETE the inline error block (the `{/* Inline error */}` comment and the `{error !== null && (<p role="alert" ...>{t(error)}</p>)}` expression). Leaving it in would render the message twice and break `getByRole("alert")` with "found multiple elements".

- [ ] **Step 6: Run the tests**

Run: `cd apps/dashboard && bunx vitest run components/people/import/upload-step.test.tsx`
Expected: PASS, 21 tests. All three new cases pass, and the two original error tests (`shows errorNotCsv ...`, `shows errorEmpty ...`) still pass because they assert on `getByRole("alert")`, which now resolves to the card's description.

- [ ] **Step 7: Full verification**

Run: `bun run typecheck` then `bun run test` then `bunx biome check apps/dashboard`
Expected: typecheck 9/9; the full suite green; biome reporting no new errors. If biome reports a formatting error, run `bunx biome check --write` on the two touched files.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/components/people/import/upload-step.tsx apps/dashboard/components/people/import/upload-step.test.tsx
git commit -m "feat(import): name the rejected file in an error card"
```

---

## Manual check (after both tasks)

The plan's tests cover the done and error cards. The uploading card and the visual result are not covered by jsdom, so confirm in the browser once:

```bash
cd apps/dashboard && bun run dev   # http://localhost:3001
```

Go to the people import wizard and check: the card fills the step width (not hugging its content, which would mean the `w-full` was dropped); the progress bar sits inside the card on its own row; dropping a `.xls` renamed to `.csv` shows a dashed destructive card naming the file; the filename shimmers while a large file reads.

## Out of scope

`FileDropzone`, the avatar and org-logo image uploads, and `AttachmentGroup` (import takes a single file). No change to CSV parsing, validation, the OLE2 sniff, the wizard step flow, or any i18n message.
