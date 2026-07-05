"use client"

import { ImportFormatError, tokenizeCsv } from "@workspace/import"
import { Button } from "@workspace/ui/components/button"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import type { ParsedCsv } from "./import-wizard"

// Accepts a raw CSV text string, validates it, and returns either a ParsedCsv
// result or an error key. Kept as a named export so tests can call it directly
// without rendering the component.
export function handleCsvText(
  text: string
):
  | { ok: true; parsed: ParsedCsv }
  | { ok: false; error: "errorEmpty" | "errorNotCsv" | "errorInvalidFormat" } {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return { ok: false, error: "errorEmpty" }
  }
  let parsed: ParsedCsv
  try {
    parsed = tokenizeCsv(text)
  } catch (err) {
    if (err instanceof ImportFormatError) {
      return { ok: false, error: "errorInvalidFormat" }
    }
    throw err
  }
  if (parsed.headers.length === 0) {
    return { ok: false, error: "errorEmpty" }
  }
  if (parsed.rows.length === 0) {
    return { ok: false, error: "errorEmpty" }
  }
  return { ok: true, parsed }
}

export function UploadStep({
  parsed,
  onParsed,
}: {
  parsed: ParsedCsv | null
  onParsed: (result: ParsedCsv, csvText: string) => void
}) {
  const t = useTranslations("dashboard.people.import.upload")
  const [error, setError] = useState<
    "errorEmpty" | "errorNotCsv" | "errorInvalidFormat" | null
  >(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError("errorNotCsv")
      return
    }
    file
      .text()
      .then((text) => {
        const result = handleCsvText(text)
        if (result.ok) {
          setError(null)
          onParsed(result.parsed, text)
        } else {
          setError(result.error)
        }
      })
      .catch(() => {
        setError("errorEmpty")
      })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file === undefined) return
    processFile(file)
    // Reset input so re-selecting the same file re-triggers the handler.
    e.target.value = ""
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file === undefined) return
    processFile(file)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Drop zone: <section> with aria-label gives the region role without
          an explicit role attribute (satisfies Biome a11y/useSemanticElements). */}
      <section
        aria-label={t("heading")}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          "flex w-full cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          isDragOver
            ? "border-brand bg-brand/5"
            : "border-border hover:border-brand/40 hover:bg-brand/10",
        ].join(" ")}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the whole zone is the interactive element
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={handleFileChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="flex flex-col items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              inputRef.current?.click()
            }}
            tabIndex={-1}
          >
            {t("chooseFile")}
          </Button>
          <p className="text-muted-foreground text-sm">{t("dropHint")}</p>
        </div>
      </section>

      {/* Inline error */}
      {error !== null && (
        <p role="alert" className="text-destructive text-sm">
          {t(error)}
        </p>
      )}

      {/* Detection summary: shown when a file has been successfully parsed */}
      {parsed !== null && error === null && (
        <p
          className="text-muted-foreground text-sm"
          data-testid="detected-summary"
        >
          {t("detected", {
            rows: parsed.rows.length,
            columns: parsed.headers.length,
          })}
        </p>
      )}
    </div>
  )
}
