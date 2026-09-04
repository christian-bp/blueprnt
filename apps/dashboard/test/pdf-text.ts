// The text a PDF document component would print, read off the element tree
// it builds rather than off the rendered bytes: @react-pdf compresses its
// content streams, so a rendered blob cannot be searched for a string.
//
// Function components are invoked so a row rendered by a table helper is
// reached too; the PDF kit's components are pure and hook-free, and a
// component that will not run falls back to its own children rather than
// failing the walk. Every string (and number) is one entry, in document
// order, so a label and the value beside it stay separate entries.
import { isValidElement, type ReactNode } from "react"

export function renderedText(node: ReactNode): string[] {
  if (node === null || node === undefined || typeof node === "boolean") {
    return []
  }
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)]
  }
  if (Array.isArray(node)) return node.flatMap(renderedText)
  if (!isValidElement(node)) return []
  const { children } = node.props as { children?: ReactNode }
  if (typeof node.type === "function") {
    try {
      const rendered = (node.type as (props: unknown) => ReactNode)(node.props)
      return renderedText(rendered)
    } catch {
      return renderedText(children)
    }
  }
  return renderedText(children)
}
