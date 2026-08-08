import { redirect } from "next/navigation"

// The analysis section has no page of its own: every route under it IS a
// chapter. It briefly had one ("Läget") carrying what is next, the
// completion panel and the supplementary drawer, but it listed no steps,
// and a page with no work on it is where this surface's bugs kept coming
// from. Its contents moved to where they belong: the spine and the chapter
// tab row already answer "how far along" on every page, finishing lives on
// the run's Overview, and the drawer sits on the chapter it is about.
//
// Kept as a redirect rather than deleted, so the section's own path stays a
// valid address instead of a 404. Callers link to the chapter directly.
export default async function PayMappingAnalysisPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/pay-mappings/${slug}/analysis/start`)
}
