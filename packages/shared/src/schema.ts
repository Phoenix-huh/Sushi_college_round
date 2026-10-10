import { z } from "zod";

// Patch anchor — describes how to find the target element
export const PatchAnchorSchema = z.object({
  cssSelector: z.string(),
  xpath: z.string(),
  textContent: z.string(),
  attributes: z.record(z.string()),
  parentContext: z.string().describe("CSS selector of parent chain"),
  siblingContext: z.array(z.string()).describe("Text/tag of adjacent siblings"),
});

// Patch change — what to modify
export const PatchChangeSchema = z.object({
  type: z.enum(["text", "style", "visibility", "script", "attribute", "remove", "move", "behavior"]),
  value: z.string(),
});

// Patch status
export const PatchStatusSchema = z.enum([
  "draft",
  "in_review",
  "approved",
  "live",
  "conflicted",
  "rejected",
  "stale",
  "broken",
  "healed",
]);

// Patch Op — one element + one property
export const PatchOpSchema = z.object({
  id: z.string().uuid(),
  patch_id: z.string().uuid(),
  anchors: PatchAnchorSchema,
  property: z.string(),
  old_value: z.string().nullable().optional(),
  new_value: z.string(),
});

// Site
export const SiteSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  url: z.string().url(),
  live_version_id: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime().optional(),
});

// Full Patch
export const PatchSchema = z.object({
  id: z.string().uuid(),
  site_id: z.string().uuid().optional(),
  title: z.string().optional(),
  target_url: z.string().url(),
  base_version: z.number().int().nonnegative(),
  anchors: PatchAnchorSchema,
  change: PatchChangeSchema,
  author_id: z.string().uuid(),
  status: PatchStatusSchema,
  ops: z.array(PatchOpSchema).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// For creating a new patch (server assigns id, timestamps)
export const CreatePatchSchema = PatchSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  status: true,
});

// Review
export const ReviewDecisionSchema = z.enum(["approved", "rejected"]);
export const ReviewSchema = z.object({
  id: z.string().uuid(),
  patch_id: z.string().uuid(),
  reviewer_id: z.string().uuid(),
  decision: ReviewDecisionSchema,
  comment: z.string().optional(),
  created_at: z.string().datetime(),
});

// Conflict
export const ConflictTypeSchema = z.enum(["concurrent", "stale_base", "semantic"]);
export const ConflictStatusSchema = z.enum(["open", "resolved"]);
export const ConflictSchema = z.object({
  id: z.string().uuid(),
  patch_a: z.string().uuid(),
  patch_b: z.string().uuid(),
  op_a: z.string().uuid().nullable().optional(),
  op_b: z.string().uuid().nullable().optional(),
  type: ConflictTypeSchema,
  status: ConflictStatusSchema,
  resolution: z.string().nullable().optional(),
  created_at: z.string().datetime().optional(),
});

// Version — a bundle of approved patches
export const VerificationStatusSchema = z.enum(["pending", "passed", "failed"]);

export const VersionSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  parent_id: z.string().uuid().nullable().optional(),
  patch_ids: z.array(z.string().uuid()),
  ops_snapshot: z.array(PatchOpSchema).optional(),
  created_by: z.string().uuid(),
  verification_status: VerificationStatusSchema,
  created_at: z.string().datetime(),
});

// Deployment
export const DeploymentSchema = z.object({
  id: z.string().uuid(),
  version_id: z.string().uuid(),
  is_live: z.boolean(),
  canary_percent: z.number().min(0).max(100).default(100),
  deployed_at: z.string().datetime(),
  rolled_back_at: z.string().datetime().nullable(),
});

// Audit event
export const AuditEventTypeSchema = z.enum([
  "patch_created",
  "patch_updated",
  "patch_submitted",
  "patch_reviewed",
  "patch_approved",
  "patch_merged",
  "patch_rebased",
  "conflict_resolved",
  "patch_healed",
  "patch_broken",
  "version_created",
  "deployment_created",
  "deployment_rolled_back",
  "verification_passed",
  "verification_failed",
  "conflict_detected",
  "site_created",
]);

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  actor_id: z.string().uuid(),
  event_type: AuditEventTypeSchema,
  entity_id: z.string().uuid(),
  details: z.record(z.unknown()),
  created_at: z.string().datetime(),
});
