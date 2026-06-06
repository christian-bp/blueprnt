/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts_context from "../accounts/context.js";
import type * as accounts_mirrors from "../accounts/mirrors.js";
import type * as accounts_onboarding from "../accounts/onboarding.js";
import type * as accounts_organization from "../accounts/organization.js";
import type * as accounts_tables from "../accounts/tables.js";
import type * as ai_config from "../ai/config.js";
import type * as ai_generate from "../ai/generate.js";
import type * as ai_persist from "../ai/persist.js";
import type * as ai_provider from "../ai/provider.js";
import type * as ai_suggest from "../ai/suggest.js";
import type * as assessment_compute from "../assessment/compute.js";
import type * as assessment_families from "../assessment/families.js";
import type * as assessment_industryStarters from "../assessment/industryStarters.js";
import type * as assessment_names from "../assessment/names.js";
import type * as assessment_ratings from "../assessment/ratings.js";
import type * as assessment_results from "../assessment/results.js";
import type * as assessment_roles from "../assessment/roles.js";
import type * as assessment_starters from "../assessment/starters.js";
import type * as assessment_tables from "../assessment/tables.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as devReset from "../devReset.js";
import type * as email_outbox from "../email/outbox.js";
import type * as email_tables from "../email/tables.js";
import type * as evaluationModel_criteria from "../evaluationModel/criteria.js";
import type * as evaluationModel_localize from "../evaluationModel/localize.js";
import type * as evaluationModel_model from "../evaluationModel/model.js";
import type * as evaluationModel_standardTemplate from "../evaluationModel/standardTemplate.js";
import type * as evaluationModel_tables from "../evaluationModel/tables.js";
import type * as http from "../http.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_functions from "../lib/functions.js";
import type * as seed from "../seed.js";
import type * as shared_tables from "../shared/tables.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "accounts/context": typeof accounts_context;
  "accounts/mirrors": typeof accounts_mirrors;
  "accounts/onboarding": typeof accounts_onboarding;
  "accounts/organization": typeof accounts_organization;
  "accounts/tables": typeof accounts_tables;
  "ai/config": typeof ai_config;
  "ai/generate": typeof ai_generate;
  "ai/persist": typeof ai_persist;
  "ai/provider": typeof ai_provider;
  "ai/suggest": typeof ai_suggest;
  "assessment/compute": typeof assessment_compute;
  "assessment/families": typeof assessment_families;
  "assessment/industryStarters": typeof assessment_industryStarters;
  "assessment/names": typeof assessment_names;
  "assessment/ratings": typeof assessment_ratings;
  "assessment/results": typeof assessment_results;
  "assessment/roles": typeof assessment_roles;
  "assessment/starters": typeof assessment_starters;
  "assessment/tables": typeof assessment_tables;
  auth: typeof auth;
  crons: typeof crons;
  devReset: typeof devReset;
  "email/outbox": typeof email_outbox;
  "email/tables": typeof email_tables;
  "evaluationModel/criteria": typeof evaluationModel_criteria;
  "evaluationModel/localize": typeof evaluationModel_localize;
  "evaluationModel/model": typeof evaluationModel_model;
  "evaluationModel/standardTemplate": typeof evaluationModel_standardTemplate;
  "evaluationModel/tables": typeof evaluationModel_tables;
  http: typeof http;
  "lib/audit": typeof lib_audit;
  "lib/errors": typeof lib_errors;
  "lib/functions": typeof lib_functions;
  seed: typeof seed;
  "shared/tables": typeof shared_tables;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
};
