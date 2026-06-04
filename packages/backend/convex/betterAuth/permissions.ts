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

// Deliberate V1 posture: no role carries organization:["delete"], so no
// member (including the creator) can delete a workspace from the product.
// Tenant deletion is an out-of-band support operation. Revisit post-V1.
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
