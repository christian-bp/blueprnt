import { redirect } from "next/navigation"

// The model section has no page of its own: every route under it IS a chapter,
// and the spine and the chapter tab row in the layout above already answer
// "how far along" on every one of them. Kept as a redirect rather than deleted
// so the section's own path stays a valid address instead of a 404: every
// existing link, bookmark and sidebar row that names /model still lands on the
// first chapter.
export default function ModelPage() {
  redirect("/model/criteria")
}
