import Link from "next/link"
import { getTranslations } from "next-intl/server"

// Covers /docs/[slug] for an unknown slug (e.g. an assistant link that got a
// path wrong) and anything else under /docs with no matching route.
export default async function DocsNotFound() {
  const t = await getTranslations("dashboard.docs.notFound")
  return (
    <div className="mx-auto max-w-4xl pb-16">
      <h1 className="font-semibold text-2xl">{t("title")}</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">{t("body")}</p>
      <Link
        href="/docs"
        className="mt-6 inline-block text-brand hover:underline"
      >
        {t("backToIndex")}
      </Link>
    </div>
  )
}
