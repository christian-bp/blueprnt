import { Text } from "@react-email/components"
import { BaseEmailTemplate } from "../components/base-email"
import { CtaButton } from "../components/button"
import { colors } from "../components/theme"
import { emailMessages, fillTemplate } from "../messages"

export interface ChangeEmailConfirmEmailProps {
  url: string
  newEmail: string
  locale: string
}

export function ChangeEmailConfirmEmail({
  url,
  newEmail,
  locale,
}: ChangeEmailConfirmEmailProps) {
  const m = emailMessages(locale).changeEmailConfirm
  return (
    <BaseEmailTemplate preview={m.subject} title={m.heading} locale={locale}>
      <Text
        className="m-0 text-[16px] leading-[26px]"
        style={{ color: colors.text }}
      >
        {fillTemplate(m.body, { newEmail })}
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

ChangeEmailConfirmEmail.PreviewProps = {
  url: "https://app.blueprnt.se/confirm-email-change?token=preview",
  newEmail: "new@example.com",
  locale: "en",
} satisfies ChangeEmailConfirmEmailProps

export default ChangeEmailConfirmEmail
