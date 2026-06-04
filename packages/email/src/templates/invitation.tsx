import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components"
import { emailMessages, fillTemplate } from "../messages"

export interface InvitationEmailProps {
  inviterName: string
  workspaceName: string
  acceptUrl: string
  locale: string
}

export function InvitationEmail({
  inviterName,
  workspaceName,
  acceptUrl,
  locale,
}: InvitationEmailProps) {
  const m = emailMessages(locale).invitation
  const params = { inviterName, workspaceName }
  return (
    <Html lang={locale}>
      <Preview>{fillTemplate(m.subject, params)}</Preview>
      <Body>
        <Container>
          <Heading>{fillTemplate(m.heading, params)}</Heading>
          <Text>{fillTemplate(m.body, params)}</Text>
          <Button href={acceptUrl}>{m.cta}</Button>
        </Container>
      </Body>
    </Html>
  )
}
