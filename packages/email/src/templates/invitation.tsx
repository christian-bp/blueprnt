import { Text } from "@react-email/components"
import { BaseEmailTemplate } from "../components/base-email"
import { CtaButton } from "../components/button"
import { renderRich } from "../components/rich"
import { colors } from "../components/theme"
import { emailMessages, fillTemplate } from "../messages"

export interface InvitationEmailProps {
  inviterName: string
  organizationName: string
  acceptUrl: string
  locale: string
}

export function InvitationEmail({
  inviterName,
  organizationName,
  acceptUrl,
  locale,
}: InvitationEmailProps) {
  const m = emailMessages(locale).invitation
  const params = { inviterName, organizationName }
  return (
    <BaseEmailTemplate
      preview={fillTemplate(m.subject, params)}
      title={renderRich(m.heading, params)}
      locale={locale}
    >
      <Text
        className="m-0 text-[16px] leading-[26px]"
        style={{ color: colors.text }}
      >
        {renderRich(m.body, params)}
      </Text>
      <CtaButton href={acceptUrl}>{m.cta}</CtaButton>
      <Text
        className="m-0 text-[14px] leading-[22px]"
        style={{ color: colors.muted }}
      >
        {m.note}
      </Text>
    </BaseEmailTemplate>
  )
}

InvitationEmail.PreviewProps = {
  inviterName: "Anna",
  organizationName: "Acme",
  acceptUrl: "https://app.blueprnt.se/accept-invitation/inv_1",
  locale: "en",
} satisfies InvitationEmailProps

export default InvitationEmail
