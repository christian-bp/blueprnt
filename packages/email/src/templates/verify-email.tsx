import { Text } from "@react-email/components"
import { BaseEmailTemplate } from "../components/base-email"
import { CtaButton } from "../components/button"
import { colors } from "../components/theme"
import { emailMessages } from "../messages"

export interface VerifyEmailProps {
  url: string
  locale: string
}

export function VerifyEmail({ url, locale }: VerifyEmailProps) {
  const m = emailMessages(locale).verifyEmail
  return (
    <BaseEmailTemplate preview={m.subject} title={m.heading} locale={locale}>
      <Text
        className="m-0 text-[16px] leading-[26px]"
        style={{ color: colors.text }}
      >
        {m.body}
      </Text>
      <CtaButton href={url}>{m.cta}</CtaButton>
      <Text
        className="m-0 text-[14px] leading-[22px]"
        style={{ color: colors.muted }}
      >
        {m.note}
      </Text>
    </BaseEmailTemplate>
  )
}

VerifyEmail.PreviewProps = {
  url: "https://app.blueprnt.se/verify-email?token=preview",
  locale: "en",
} satisfies VerifyEmailProps

export default VerifyEmail
