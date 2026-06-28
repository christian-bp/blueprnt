import {
  AUDIT_EVENTS,
  PLATFORM_AUDIT_EVENTS,
} from "@workspace/backend/convex/lib/audit"
import en from "@workspace/i18n/messages/en.json"
import { describe, expect, it } from "vitest"

// The audit log renders an event's readable label from i18n and falls back to
// the raw event type when none exists. These tests guard that EVERY audit event
// has a label, so adding an AUDIT_EVENTS value without its i18n string fails CI
// instead of silently showing a raw key like "organization.logoUpdated". The
// key derivation mirrors org-audit-log-section.tsx (camelCase across dots) and
// the admin audit-log section (strip the "platform." prefix). Checking en is
// enough: the i18n parity test guarantees the other locales mirror en's keys.

const orgEventKey = (type: string) =>
  type
    .split(".")
    .map((part, index) =>
      index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("")

describe("audit log event labels", () => {
  it("every org audit event has a readable label in dashboard.auditLog.events", () => {
    const labels = en.dashboard.auditLog.events as Record<string, string>
    const missing = Object.values(AUDIT_EVENTS).filter(
      (type) => !(orgEventKey(type) in labels)
    )
    expect(missing).toEqual([])
  })

  it("every platform audit event has a label in dashboard.admin.auditLog.events", () => {
    const labels = en.dashboard.admin.auditLog.events as Record<string, string>
    const missing = Object.values(PLATFORM_AUDIT_EVENTS).filter(
      (type) => !(type.replace("platform.", "") in labels)
    )
    expect(missing).toEqual([])
  })
})
