import { createAccessControl } from "better-auth/plugins/access"
import {
  adminAc,
  defaultStatements,
} from "better-auth/plugins/organization/access"

// Admin: configures the model and manages members (owner-equivalent).
// Editor: registers roles and enters ratings; cannot touch configuration.
// Domain resources beyond Better Auth's defaults; later slices consume these
// statements (model = evaluation model config).
export const statement = {
  ...defaultStatements,
  model: ["update"],
  role: ["create", "read", "update", "archive"],
  rating: ["create", "read", "update"],
} as const

export const ac = createAccessControl(statement)

export const admin = ac.newRole({
  ...adminAc.statements,
  model: ["update"],
  role: ["create", "read", "update", "archive"],
  rating: ["create", "read", "update"],
})

export const editor = ac.newRole({
  role: ["create", "read", "update", "archive"],
  rating: ["create", "read", "update"],
})
