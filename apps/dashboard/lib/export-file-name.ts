// A run label is free text; a file or ZIP-entry name is not. Path
// separators in a label (an ordinary fiscal-year label like "2026/2027")
// would nest the archive's entries, because jszip treats "/" as a folder
// boundary, breaking the package's documented flat layout. They fold to a
// hyphen here, in the one place every export file name is built from; the
// rest of the label stays as the user wrote it (the browser sanitizes the
// download attribute itself, but ZIP entries have no such guard).
export function exportFileLabel(label: string): string {
  return label.replace(/[/\\]/g, "-")
}
