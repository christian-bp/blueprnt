import type { ReactNode } from "react"
import { fillTemplate } from "../messages"
import { colors } from "./theme"

// Renders an email i18n string with two conventions: {placeholders} are
// interpolated from params, and <b>...</b> spans are emphasized in the brand
// color (the same brand accent the app uses for names and titles). Returns
// inline ReactNodes suitable as <Text>/<Heading> children. In the plain-text
// render the spans degrade to their text content, so no markup leaks.
export function renderRich(
  template: string,
  params: Record<string, string> = {}
): ReactNode[] {
  const filled = fillTemplate(template, params)
  return filled.split(/<b>([\s\S]*?)<\/b>/g).map((part, i) =>
    i % 2 === 1 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: split order is stable
      <span key={i} style={{ color: colors.brand, fontWeight: 600 }}>
        {part}
      </span>
    ) : (
      part
    )
  )
}
