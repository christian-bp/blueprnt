import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useTranslations } from "next-intl"
import Link from "next/link"

// Static guidance card for the overview side column (the reference's support-card
// analog): a short "what to do" blurb and a link into the model. Guidance is the
// product's primary goal, so the front page states the flow in plain language.
export function GettingStartedCard() {
  const t = useTranslations("dashboard.overview.gettingStarted")
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          href="/model"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          {t("cta")}
        </Link>
      </CardContent>
    </Card>
  )
}
