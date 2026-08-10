// Shared geometry for the app's dialogs, so a dialog's size is one decision
// instead of a literal per call site (the same reasoning as chart-style.ts).

// A form dialog that can outgrow the viewport: it scrolls inside itself rather
// than overflowing off-screen, and sits a step wider than the default
// sm:max-w-md because a form needs the room.
//
// svh, not vh: on mobile, vh is the viewport WITHOUT browser chrome, so a
// vh-capped dialog puts its footer (where the submit button lives) under the
// address bar. svh measures the small viewport, which is the one actually
// visible.
//
// A dialog that needs a different width composes through cn(), where
// tailwind-merge drops the max-width from here in favour of the later class:
//   <DialogContent className={cn(FORM_DIALOG_CONTENT, "sm:max-w-2xl")}>
export const FORM_DIALOG_CONTENT = "max-h-[85svh] overflow-y-auto sm:max-w-lg"
