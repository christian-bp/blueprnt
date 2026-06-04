// Static auth instance used ONLY by the Better Auth CLI for schema
// generation. Convex push analysis executes this module without deployment
// env vars, and baseURL is irrelevant for schema generation, so a
// placeholder is passed explicitly. Runtime code uses createAuth(ctx).
import { betterAuth } from "better-auth/minimal"
import { createAuthOptions } from "../auth"

export const auth = betterAuth(
  createAuthOptions({} as never, { baseURL: "http://localhost" })
)
