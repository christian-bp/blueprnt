import { type Locale, routing } from "@workspace/i18n/routing"
import { getDocsIndex } from "@/lib/docs/docs-index"

// The command palette's guide index, fetched the first time the palette
// opens rather than handed down from the layout.
//
// Measured, not assumed: the index is 17-19 KB of JSON per locale (56
// guides, 330 headings; en 17.0 KB, fi 19.1 KB, 5.5-5.9 KB gzipped, from
// serializing getDocsIndex for each locale). Passing it as a layout prop
// would put those ~18 KB in the RSC payload of EVERY page and every
// client-side navigation, for a surface most sessions never open. Behind this handler it costs nothing until a user
// presses the shortcut, and the client caches it per locale for the rest of
// the session, so it is fetched at most once.
//
// The locale is a query parameter rather than the request cookie because the
// UI language is reactive on the client (LocaleProvider follows a Convex
// subscription and swaps bundles live), so the cookie can lag behind the
// language the user is actually reading. Only the configured locales are
// accepted, which is both the 400 rule and the path-traversal guard, since
// the value reaches the filesystem.
export async function GET(request: Request): Promise<Response> {
  const requested = new URL(request.url).searchParams.get("locale") ?? ""
  if (!routing.locales.includes(requested as Locale)) {
    return new Response(null, { status: 400 })
  }
  const index = await getDocsIndex(requested)
  return Response.json(index, {
    // Guide titles and headings, identical for every user and changing only
    // with a deployment: cacheable, and an hour-stale list of titles is not a
    // correctness problem.
    headers: { "cache-control": "public, max-age=3600" },
  })
}
