import Link from "next/link"
import { getTranslations } from "next-intl/server"

// Last-resort boundary for a notFound() thrown outside the app shell (the
// sign-in and invitation routes). Unmatched URLs never reach here: the
// catch-all under (app) collects those so they render with request context,
// and therefore in the reader's language.
export default async function NotFound() {
  const t = await getTranslations("dashboard.notFound")
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-semibold text-2xl">{t("title")}</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">{t("body")}</p>
      <Link href="/" className="mt-6 inline-block text-brand hover:underline">
        {t("backHome")}
      </Link>
    </div>
  )
}
