import { useTranslations } from "next-intl"

// Hero section of the about page. Mirrors the variant's structure:
// a brand badge, a large display heading, and a generous lede paragraph.
// Layout is left-aligned (max-w-3xl) consistent with the how-it-works page.
export function AboutHero() {
  const t = useTranslations("web.about")

  return (
    <section className="px-6 pt-24 pb-20">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <h1 className="mb-8 font-display font-extrabold text-5xl leading-[0.95] tracking-tight md:text-6xl">
            {t("heading")}
          </h1>

          <p className="text-muted-foreground text-xl leading-relaxed">
            {t("lede")}
          </p>
        </div>
      </div>
    </section>
  )
}
