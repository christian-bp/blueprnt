# Import upload step on the Attachment component

**Goal:** Replace the hand-rolled file cards in the people-import upload step with the vendored `Attachment` component, collapsing two duplicated card shells into one state-driven element and giving a rejected file its own card that names the file that failed.

**Context (audit):** `apps/dashboard/components/people/import/upload-step.tsx` renders two near-identical hand-built cards, one for the in-flight read (lines 163-181) and one for the accepted file (lines 184-219), plus a detached `<p role="alert">` for errors (lines 222-226). Both cards repeat the same shell (`rounded-lg border bg-card p-3`), the same `size-10 rounded-md bg-muted` media square, the same `truncate font-medium text-sm` filename and the same `text-muted-foreground text-xs` meta line. `packages/ui/src/components/attachment.tsx` (vendored in the shadcn registry sync) provides exactly this anatomy with a `state` prop covering `idle | uploading | processing | error | done`, which is the state machine `upload-step.tsx` hand-manages via `reading`, `error` and `showCompleted`. CLAUDE.md requires building UI from the design system when a component exists, so the hand-rolled card is now the deviation.

## Global constraints

- `packages/ui/src/components/attachment.tsx` is vendor code and is **not** modified. All adaptation happens at the call site.
- No new i18n keys. The existing `dashboard.people.import.upload.*` messages (`uploading`, `detected`, `removeFile`, `errorEmpty`, `errorNotCsv`, `errorInvalidFormat`) are reused as-is.
- The exported pure helpers `handleCsvText`, `isOle2Signature` and `formatFileSize` are untouched, along with their direct tests.
- No backend changes. No changes to `ParsedCsv` or the `onParsed` / `onClear` contract with `import-wizard.tsx`.

## Component mapping

| Current markup | Replacement |
| --- | --- |
| card shell, written twice | `Attachment` root, `state` driven |
| `size-10 rounded-md bg-muted` media box, written twice | `AttachmentMedia` |
| filename `<p>` | `AttachmentTitle` |
| meta `<p>` | `AttachmentDescription` |
| ghost icon `Button` + `aria-label` | `AttachmentActions` + `AttachmentAction` |
| `<p role="alert">` below the dropzone | `state="error"` on the card, `role="alert"` on the description |

## Structure

Exactly one card renders at a time. The three source branches are already mutually exclusive (`processFile` clears `reading` before setting `error`, and `showCompleted` requires `error === null`), so a single derived value is sound:

```tsx
const state = reading ? "uploading" : error ? "error" : showCompleted ? "done" : null
```

`state === null` means no file has been picked yet, so **no card renders at all** (the `Attachment` root is only reached when `state !== null`; its `state` prop never receives `null`). Per state, the card takes:

| state | testid on the root | title | description | actions |
| --- | --- | --- | --- | --- |
| `uploading` | `uploading-file` | `reading.name` | `t("uploading", { progress })` | none, plus a `Progress` row |
| `done` | `detected-summary` | `fileName` | size and shape (below) | remove |
| `error` | `rejected-file` | `rejected.name` | `t(error)` | none |

The `done` description keeps today's null guard on size: `` `${fileSize !== null ? `${formatFileSize(fileSize)} · ` : ""}${t("detected", { rows, columns })}` ``.

The `error` card carries no actions: the dropzone stays available directly above it, and picking another file clears the error, so a remove control would be redundant.

```tsx
{state !== null && (
  <Attachment state={state} className="w-full" data-testid={testId}>
    <AttachmentMedia>
      {state === "uploading" ? <Spinner />
        : state === "error"   ? <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} aria-hidden="true" />
        :                      <HugeiconsIcon icon={Csv01Icon} size={20} strokeWidth={1.5} aria-hidden="true" />}
    </AttachmentMedia>
    <AttachmentContent>
      <AttachmentTitle>{title}</AttachmentTitle>
      <AttachmentDescription role={state === "error" ? "alert" : undefined}>
        {description}
      </AttachmentDescription>
    </AttachmentContent>
    {state === "done" && (
      <AttachmentActions>
        <AttachmentAction onClick={onClear} aria-label={t("removeFile", { file: fileName })} data-testid="remove-file">
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </AttachmentAction>
      </AttachmentActions>
    )}
    {state === "uploading" && <Progress value={reading.progress} className="basis-full" />}
  </Attachment>
)}
```

## New state: the rejected file

Today every error path returns before `setReading`, so the rejected file's name is discarded and the user sees a bare message. Add one state field:

```tsx
const [rejected, setRejected] = useState<{ name: string } | null>(null)
```

`processFile` sets it alongside every `setError` call (the `file` object is already in closure at each of the four error sites: the extension/MIME check, the OLE2 sniff, `reader.onerror`, and the `handleCsvText` failure branch). It is cleared whenever a new file is picked and on `onClear`. The title of the error card reads from `rejected.name`.

## Call-site overrides (with reasons)

- `className="w-full"` on the root: `Attachment` is `w-fit min-w-40` so it hugs its content, but this card fills the wizard step.
- `className="basis-full"` on `Progress`: the root is `flex-wrap`, so this forces the bar onto its own row inside the card rather than leaving it detached below.

Nothing else is overridden. `AttachmentMedia` already tints itself `bg-destructive/10 text-destructive` under `state="error"`, so the error icon needs no colour of its own, and `AttachmentAction` is already a ghost `icon-xs` `Button`.

## Shimmer

`AttachmentTitle` applies `shimmer` while the root is `uploading` or `processing`. This works with no CSS work from us: `shimmer` is defined in the `shadcn` npm package at `dist/tailwind.css`, which `packages/ui/src/styles/globals.css` imports, and it carries its own `prefers-reduced-motion` guard upstream. It is kept **alongside** the determinate `Progress` bar: the shimmer signals "working", the bar reports how far, driven by real `FileReader` byte progress.

## Testing

`upload-step.test.tsx` keeps its three existing hooks (`data-testid="uploading-file"`, `detected-summary`, `remove-file`), which move onto the new markup per the table above, so its current assertions pass unchanged. The error card adds a fourth, `rejected-file`. New cases:

- A rejected file renders an error card naming the file (e.g. picking a `.xls` shows `legacy-export.xls`).
- The error message is still announced (`role="alert"` present on the description).
- Picking a new file after a rejection clears the error card.

`import-wizard.test.tsx` is unaffected: the `onParsed` / `onClear` contract does not change.

## Excluded (with rationale)

- **`FileDropzone`** keeps owning drop and click mechanics and its own tests. `Attachment`'s `state="idle"` (which ships `border-dashed`) could host a drop affordance, but folding the two together is a rework, not a swap.
- **The image uploads** (`avatar-upload.tsx`, `account/avatar-section.tsx`, `organization/organization-logo-section.tsx`) stay on their `Avatar`-based UI. `AttachmentMedia variant="image"` would fit, but those surfaces work and touching them widens the change.
- **`AttachmentGroup`** is never used: import takes a single file.

## Non-goals

No change to CSV parsing, validation, the OLE2 sniff, the wizard's step flow, or any i18n message. No new utility CSS.
