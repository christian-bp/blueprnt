// Derive at most two initials from a display name, falling back to the first
// letter of the fallback text (typically an email), or "?" when neither is
// present. The single source for every avatar's initials fallback.
export function initialsOf(name: string, fallback = ""): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 0) {
    return parts
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase()
  }
  if (fallback.length > 0) return (fallback[0] ?? "").toUpperCase()
  return "?"
}
