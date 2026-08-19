import { redirect } from "next/navigation"

// Weighting stopped being a page of its own: a criterion's weight is set on
// the card the criterion sits in, on the build view. The route stays as a
// redirect so links and bookmarks that named it still land where the work is.
export default function ModelWeightingPage() {
  redirect("/model")
}
