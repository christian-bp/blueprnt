import { EMAIL_TEMPLATE_KEYS } from "@workspace/constants"
import en from "@workspace/i18n/messages/en.json"
import { describe, expect, it } from "vitest"

// The email log renders a readable label for each template key (the campaignTag
// each send is tagged with), and its "type" filter maps over EMAIL_TEMPLATE_KEYS
// directly (email-log-section.tsx). A key without a label throws
// MISSING_MESSAGE at runtime (the dropdown crashed on twoFactorCode /
// changeEmailConfirm / verifyEmail once). This guards that EVERY template key
// has a label, so adding an EMAIL_TEMPLATE_KEYS value without its i18n string
// fails CI instead of crashing the page. Checking en is enough: the i18n parity
// test guarantees the other locales mirror en's keys.

describe("email log template labels", () => {
  it("every email template key has a label in dashboard.admin.emailLog.templates", () => {
    const labels = en.dashboard.admin.emailLog.templates as Record<
      string,
      string
    >
    const missing = EMAIL_TEMPLATE_KEYS.filter((key) => !(key in labels))
    expect(missing).toEqual([])
  })
})
