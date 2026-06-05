// Better Auth organizations require a slug; derive one from the name and
// add a random suffix so retries and duplicate names never collide.
export function organizationSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base.length > 0 ? base : "organization"}-${suffix}`
}
