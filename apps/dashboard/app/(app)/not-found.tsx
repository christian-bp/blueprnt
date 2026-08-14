import Link from "next/link"
import { getTranslations } from "next-intl/server"

// The app shell's not-found boundary: reached both by a route that calls
// notFound() itself and by the catch-all that collects every unmatched URL.
export default async function AppNotFound() {
  const t = await getTranslations("dashboard.notFound")
  return (
    <div className="mx-auto max-w-4xl pb-16">
      <h1 className="font-semibold text-2xl">{t("title")}</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">{t("body")}</p>
      <Link href="/" className="mt-6 inline-block text-brand hover:underline">
        {t("backHome")}
      </Link>
    </div>
  )
}
