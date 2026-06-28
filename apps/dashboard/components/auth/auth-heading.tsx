import type { ReactNode } from "react"

// The shared auth heading: a centered title with an optional muted description
// beneath. Used by the sign-in, password, and forgot screens. The title is not
// animated (the animated brand statement lives in the BrandPanel's value line).
export function AuthHeading({
  title,
  description,
}: {
  title: string
  description?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <h1 className="text-center font-semibold text-brand text-xl">{title}</h1>
      {description !== undefined ? (
        <p className="text-center text-muted-foreground text-sm">
          {description}
        </p>
      ) : null}
    </div>
  )
}
