import { notFound } from "next/navigation"

// Every URL that matches no other route resolves here, so the miss is
// handled by a normal route render (which has request context, and therefore
// the reader's locale) and answers through the app's own not-found boundary.
// Next's global not-found renders without that context and would fall back to
// English inside an empty shell.
//
// The trade-off is the response status: the app shell streams before
// notFound() runs, so these answer 200 rather than 404, exactly as the
// docs boundary already did. The app is behind a login and is not crawled,
// so a localized page inside the shell is worth more here than the status.
export default function UnmatchedPage(): never {
  notFound()
}
