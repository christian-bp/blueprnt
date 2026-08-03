import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { mockAction } from "@/test/convex-mocks"

const prefillMock = mockAction("ai.prefill.prefillRoleProfiles")

vi.mock("convex/react", async () => {
  return (await import("@/test/convex-mocks")).convexReactModule
})
vi.mock("@workspace/backend/convex/_generated/api", async () => {
  return (await import("@/test/convex-mocks")).apiModule
})

import {
  prefillProgressOf,
  useProfilePrefill,
} from "@/hooks/use-profile-prefill"

type Hook = ReturnType<typeof useProfilePrefill>

function renderHook(
  via: "onboardingPrefill" | "roleImportPrefill" = "onboardingPrefill"
) {
  const captured: { current: Hook | null } = { current: null }
  function Probe() {
    captured.current = useProfilePrefill({ orgId: "org-1", via })
    return null
  }
  render(<Probe />)
  return captured
}

describe("prefillProgressOf", () => {
  const roles = [
    { roleId: "r1" as never, profileComplete: true },
    { roleId: "r2" as never, profileComplete: false },
    { roleId: "r3" as never, profileComplete: true },
  ]

  it("measures every role when no scope is given", () => {
    expect(prefillProgressOf(roles)).toEqual({ done: 2, total: 3 })
  })

  it("measures only the scoped roles", () => {
    expect(prefillProgressOf(roles, ["r2" as never, "r3" as never])).toEqual({
      done: 1,
      total: 2,
    })
  })

  it("counts a scoped role the query has not reported yet toward the total", () => {
    expect(prefillProgressOf(roles, ["r3" as never, "r9" as never])).toEqual({
      done: 1,
      total: 2,
    })
  })

  it("treats a still-loading role list as zero done", () => {
    expect(prefillProgressOf(undefined)).toEqual({ done: 0, total: 0 })
  })
})

describe("useProfilePrefill", () => {
  beforeEach(() => {
    prefillMock.mockReset()
    prefillMock.mockResolvedValue({ generated: 0, failed: 0 })
  })

  afterEach(() => {
    cleanup()
  })

  it("passes the role scope through to the action", async () => {
    const hook = renderHook()
    await act(async () => {
      await hook.current?.run({
        locale: "sv",
        willPrefill: true,
        roleIds: ["r1" as never, "r2" as never],
      })
    })
    expect(prefillMock).toHaveBeenCalledWith({
      orgId: "org-1",
      locale: "sv",
      via: "onboardingPrefill",
      roleIds: ["r1", "r2"],
    })
  })

  // The provenance the run records is the CALLING SURFACE's: an in-app import
  // attributed to onboarding is a false audit record. There is no default to
  // fall back on, so each surface's value has to reach the action intact.
  it("passes the calling surface through as the prefill provenance", async () => {
    const hook = renderHook("roleImportPrefill")
    await act(async () => {
      await hook.current?.run({ locale: "sv", willPrefill: true })
    })
    expect(prefillMock).toHaveBeenCalledWith({
      orgId: "org-1",
      locale: "sv",
      via: "roleImportPrefill",
    })
  })

  it("omits the scope key entirely when no roleIds are given", async () => {
    const hook = renderHook()
    await act(async () => {
      await hook.current?.run({ locale: "sv", willPrefill: true })
    })
    // Convex distinguishes an omitted key from an explicit undefined, so this
    // must assert on the actual key set. toHaveBeenCalledWith uses toEqual
    // semantics, which treats a { roleIds: undefined } property as equal to
    // an object without that key at all, so it would not catch a regression
    // that builds the args unconditionally.
    const args = prefillMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(Object.keys(args).sort()).toEqual(["locale", "orgId", "via"])
  })

  it("raises the prefilling flag only when the caller expects work", async () => {
    const hook = renderHook()
    await act(async () => {
      await hook.current?.run({ locale: "sv", willPrefill: false })
    })
    expect(hook.current?.prefilling).toBe(false)
  })

  it("leaves the prefilling flag set after a successful run", async () => {
    // Deliberately not cleared on success: the caller navigates away from the
    // dedicated prefilling screen itself, so clearing here would flash the
    // previous screen for one render. Only a hard rejection clears it.
    const hook = renderHook()
    await act(async () => {
      await hook.current?.run({ locale: "sv", willPrefill: true })
    })
    expect(hook.current?.prefilling).toBe(true)
  })

  it("retries once when a batch partially failed", async () => {
    prefillMock.mockResolvedValueOnce({ generated: 3, failed: 2 })
    prefillMock.mockResolvedValueOnce({ generated: 2, failed: 0 })
    const hook = renderHook()
    await act(async () => {
      await hook.current?.run({ locale: "sv", willPrefill: true })
    })
    expect(prefillMock).toHaveBeenCalledTimes(2)
  })

  it("swallows a failed retry", async () => {
    prefillMock.mockResolvedValueOnce({ generated: 1, failed: 1 })
    prefillMock.mockRejectedValueOnce(new Error("rate limited"))
    const hook = renderHook()
    await act(async () => {
      await expect(
        hook.current?.run({ locale: "sv", willPrefill: true })
      ).resolves.toBeUndefined()
    })
  })

  it("clears the flag and rethrows when the first call hard-rejects", async () => {
    prefillMock.mockRejectedValueOnce(new Error("boom"))
    const hook = renderHook()
    await act(async () => {
      await expect(
        hook.current?.run({ locale: "sv", willPrefill: true })
      ).rejects.toThrow("boom")
    })
    expect(hook.current?.prefilling).toBe(false)
  })
})
