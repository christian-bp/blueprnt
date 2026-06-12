import { useTranslations } from "next-intl"

// The "why we built blueprnt" narrative section. Surface-tinted background
// separates it from the hero. The brand accent on the product name mirrors
// the variant's inline <span className="text-brand"> treatment.
export function AboutStory() {
  const t = useTranslations("web.about.story")

  return (
    <section className="bg-surface py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <h2 className="mb-8 font-display font-extrabold text-4xl text-foreground leading-tight tracking-tight md:text-5xl">
            {t("titleLead")}{" "}
            <span className="text-brand">{t("titleAccent")}</span>
          </h2>

          <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
            <p>{t("p1")}</p>
            <p>{t("p2")}</p>
            <p>{t("p3")}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
