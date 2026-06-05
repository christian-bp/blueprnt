import { render } from "@react-email/render"
import { emailMessages, fillTemplate } from "./messages"
import {
  InvitationEmail,
  type InvitationEmailProps,
} from "./templates/invitation"
import { ResetPasswordEmail } from "./templates/reset-password"
import { VerifyEmail } from "./templates/verify-email"

export type EmailTemplateKey = "invitation" | "verifyEmail" | "resetPassword"

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

interface LinkEmailProps {
  url: string
  locale: string
}

export type EmailProps = {
  invitation: InvitationEmailProps
  verifyEmail: LinkEmailProps
  resetPassword: LinkEmailProps
}

export async function renderEmail<K extends EmailTemplateKey>(
  templateKey: K,
  props: EmailProps[K]
): Promise<RenderedEmail> {
  const m = emailMessages(props.locale)
  switch (templateKey) {
    case "invitation": {
      const p = props as InvitationEmailProps
      const element = InvitationEmail(p)
      return {
        subject: fillTemplate(m.invitation.subject, {
          inviterName: p.inviterName,
          organizationName: p.organizationName,
        }),
        html: await render(element),
        text: await render(element, { plainText: true }),
      }
    }
    case "verifyEmail": {
      const element = VerifyEmail(props as LinkEmailProps)
      return {
        subject: m.verifyEmail.subject,
        html: await render(element),
        text: await render(element, { plainText: true }),
      }
    }
    default: {
      const element = ResetPasswordEmail(props as LinkEmailProps)
      return {
        subject: m.resetPassword.subject,
        html: await render(element),
        text: await render(element, { plainText: true }),
      }
    }
  }
}
