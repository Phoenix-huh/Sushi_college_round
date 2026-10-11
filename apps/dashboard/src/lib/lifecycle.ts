/**
 * Single Source of Truth for Patchwork Lifecycle, Statuses, Healing Cascade, and API Endpoints.
 * Extracted directly from:
 *   - packages/shared/src/schema.ts
 *   - apps/server/src/routes/
 *   - apps/server/src/services/
 *   - packages/shared/src/targeting.ts
 *   - apps/demo-site/public/shared/patchwork-runtime.js
 */

export const PATCH_STATUSES = [
  'draft',
  'in_review',
  'approved',
  'live',
  'conflicted',
  'rejected',
  'stale',
  'broken',
  'healed',
] as const;

export type PatchStatus = (typeof PATCH_STATUSES)[number];

export interface StatusMeta {
  status: PatchStatus;
  label: string;
  description: string;
  badgeClass: string;
}

export const STATUS_METADATA: Record<PatchStatus, StatusMeta> = {
  draft: {
    status: 'draft',
    label: 'Draft',
    description: 'Initial state when created by a developer or generated via AI. Not visible to end visitors.',
    badgeClass: 'bg-surface-container-highest text-on-surface-variant border-outline-variant/40',
  },
  in_review: {
    status: 'in_review',
    label: 'In Review',
    description: 'Submitted for peer review with a clean rebase onto the live version. Awaiting approval.',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  },
  approved: {
    status: 'approved',
    label: 'Approved',
    description: 'Reviewed and approved by a teammate (author cannot self-approve). Ready for CAS merge.',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
  },
  live: {
    status: 'live',
    label: 'Live',
    description: 'Included in the active deployment version bundle. Delivered to visitors via GET /deployments/live.',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  },
  conflicted: {
    status: 'conflicted',
    label: 'Conflicted',
    description: 'Submit detected concurrent element+property overlap with another open patch or newer version.',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  },
  rejected: {
    status: 'rejected',
    label: 'Rejected',
    description: 'Reviewer rejected the patch with optional feedback comments.',
    badgeClass: 'bg-rose-950/60 text-rose-400 border-rose-800/40',
  },
  stale: {
    status: 'stale',
    label: 'Stale',
    description: 'Submitted patch targets an element with no valid selectors, text, or xpath anchors.',
    badgeClass: 'bg-surface-container text-outline border-outline-variant/30',
  },
  broken: {
    status: 'broken',
    label: 'Broken',
    description: 'Discarded during conflict resolution in favor of another competing patch.',
    badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700/40',
  },
  healed: {
    status: 'healed',
    label: 'Healed',
    description: 'Target element relocated on updated site; page runtime successfully matched via fuzzy tokens.',
    badgeClass: 'bg-primary-container/20 text-primary border-primary-container/40',
  },
};

export interface LifecycleStage {
  step: number;
  id: string;
  name: string;
  route: string;
  resultingStatus: PatchStatus | string;
  summary: string;
  description: string;
  details: string[];
}

export const LIFECYCLE_STAGES: LifecycleStage[] = [
  {
    step: 1,
    id: 'author',
    name: 'Author',
    route: 'POST /patches or POST /ai/patch',
    resultingStatus: 'draft',
    summary: 'Visual inspection or AI prompt creates draft patch',
    description: 'Developer uses Chrome MV3 extension to pick element or prompts Gemini 3.8 Flash to generate structured patch JSON with multi-anchor locators.',
    details: [
      'Captures CSS selector, XPath, text content, attributes, parent context, and sibling context',
      'Supports 8 change types: text, style, visibility, script, attribute, remove, move, behavior',
      'Assigned draft status and logged to audit trail (patch_created)',
    ],
  },
  {
    step: 2,
    id: 'submit',
    name: 'Submit & Conflict Check',
    route: 'POST /patches/:id/submit',
    resultingStatus: 'in_review / conflicted / stale',
    summary: 'Checks conflicts against open patches & newer versions',
    description: 'Submits patch for peer review. Computes element + property conflicts against other draft/in_review/approved patches and newer version ops.',
    details: [
      'If overlapping property edit on same element: stores conflict row, marks conflicted',
      'If target anchors are empty or missing: marks stale',
      'If clean: auto-rebases base_version to current live version, marks in_review',
    ],
  },
  {
    step: 3,
    id: 'review',
    name: 'Review & Approve',
    route: 'POST /patches/:id/review',
    resultingStatus: 'approved / rejected',
    summary: 'Peer reviewer approves or rejects (no self-approval)',
    description: 'A different team member reviews the proposed DOM change. Enforces separation of duties: author cannot approve their own patch.',
    details: [
      'Approval moves patch to approved status and logs patch_approved audit event',
      'Rejection moves patch to rejected status with reviewer comment',
      'Conflicts can also be resolved via POST /conflicts/:id/resolve (choice: a, b, or custom)',
    ],
  },
  {
    step: 4,
    id: 'deploy',
    name: 'Deploy',
    route: 'POST /patches/:id/merge or POST /deploy',
    resultingStatus: 'live',
    summary: 'Atomic CAS merge into new version & live deployment',
    description: 'Applies compare-and-swap (CAS) check, synthesizes merged ops snapshot, inserts a new incremented Version record, and sets a new live Deployment.',
    details: [
      'Increments version number (e.g. v1 -> v2) with parent_id link',
      'Updates site.live_version_id and marks patch status live',
      'Writes version_created and deployment_created audit events',
    ],
  },
  {
    step: 5,
    id: 'runtime',
    name: 'Page Runtime Delivery',
    route: 'GET /deployments/live',
    resultingStatus: 'live (or healed)',
    summary: 'Target page script polls manifest and applies changes',
    description: 'Lightweight client script included in target web application polls GET /deployments/live every 2 seconds. Reconciles DOM changes via multi-anchor matching.',
    details: [
      'Two-phase application: resolves all targets before modifying DOM',
      'If live signature changes, reloads page to cleanly synchronize state',
      'If element relocated, fuzzy token healer matches (threshold >= 0.25) and reports healed',
    ],
  },
  {
    step: 6,
    id: 'verify',
    name: 'Post-Deploy Verification',
    route: 'POST /verify',
    resultingStatus: 'passed / failed (auto-rollback)',
    summary: 'Headless Playwright test; auto-rollback if failed',
    description: 'Spawns headless Chromium to execute end-to-end user checkout flow with patches applied, comparing baseline and patched screenshots with Pixelmatch.',
    details: [
      'Does not gate deploy up front; runs asynchronously / on-demand for a version',
      'Catches broken critical user journeys (e.g. missing checkout button)',
      'If verification fails on the live version, automatically triggers rollbackLive',
    ],
  },
  {
    step: 7,
    id: 'rollback',
    name: 'Undeploy & Rollback',
    route: 'POST /patches/:id/undeploy or POST /rollback',
    resultingStatus: 'approved (removed from live)',
    summary: 'Undeploy creates new version without patch; rollback reactivates prior',
    description: 'Undeploying one patch generates a new version bundle with remaining patches. POST /rollback reactivates the previous deployment; POST /deployments/:id/activate redeploys any older deployment.',
    details: [
      'Undeploy creates next version number and moves undeployed patch back to approved',
      'Rollback marks current deployment rolled_back_at and sets previous deployment live',
      'Writes deployment_rolled_back audit event; page runtime detects new signature on next poll',
    ],
  },
];

export interface HealingTier {
  tier: number;
  name: string;
  method: string;
  codeSnippet: string;
  description: string;
  confidenceBasis: string;
}

export const HEALING_TIERS: HealingTier[] = [
  {
    tier: 1,
    name: 'Primary CSS Selector',
    method: 'selector / selector+text',
    codeSnippet: 'document.querySelectorAll(anchors.cssSelector)',
    description: 'Direct querySelector lookup. If multiple elements match the selector, disambiguates by exact textContent match (innermost descendant wins).',
    confidenceBasis: 'Exact DOM selector and textContent match',
  },
  {
    tier: 2,
    name: 'Normalized Structural XPath',
    method: 'xpath',
    codeSnippet: 'document.evaluate(anchors.xpath, document, null, 9, null)',
    description: 'Evaluates stored XPath hierarchy when CSS selector fails (e.g. if classes were modified but DOM hierarchy was preserved).',
    confidenceBasis: 'Single-node structural path match',
  },
  {
    tier: 3,
    name: 'Fuzzy Token Healer',
    method: 'healed',
    codeSnippet: 'jaccard(anchorTokens, elementTokens) >= 0.25',
    description: 'Extracts tokens from anchor id, class, name, textContent, and selector. Computes Jaccard similarity against candidate elements (filtered to <= 3 children) with a synonym map for common actions (checkout/order/buy, cart/bag, etc.).',
    confidenceBasis: 'Jaccard token similarity >= 0.25 threshold',
  },
];

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  category: 'patches' | 'deployments' | 'conflicts' | 'system';
}

export const REAL_API_ENDPOINTS: ApiEndpoint[] = [
  { method: 'GET', path: '/health', description: 'System health, timestamp, Supabase connection status, and store mode', category: 'system' },
  { method: 'GET', path: '/sites', description: 'List registered target sites and their active live_version_id', category: 'system' },
  { method: 'POST', path: '/sites', description: 'Register a new website target URL', category: 'system' },
  { method: 'GET', path: '/profiles', description: 'List available user profiles (developer and reviewer personas)', category: 'system' },
  { method: 'GET', path: '/patches', description: 'List patches with optional ?site_id= filter', category: 'patches' },
  { method: 'POST', path: '/patches', description: 'Create a new draft patch with multi-anchor locators and change payload', category: 'patches' },
  { method: 'GET', path: '/patches/:id', description: 'Retrieve a single patch by UUID', category: 'patches' },
  { method: 'PUT', path: '/patches/:id', description: 'Update patch title, change, anchors, status, or ops', category: 'patches' },
  { method: 'PUT', path: '/patches/:id/ops', description: 'Update atomic operations array on a patch', category: 'patches' },
  { method: 'DELETE', path: '/patches/:id', description: 'Undeploy patch if live and remove from store', category: 'patches' },
  { method: 'POST', path: '/patches/:id/submit', description: 'Submit patch for review: runs conflict check, auto-rebases base_version', category: 'patches' },
  { method: 'GET', path: '/patches/:id/conflicts', description: 'Get all recorded conflict rows for this patch', category: 'conflicts' },
  { method: 'POST', path: '/patches/:id/review', description: 'Submit review decision (approved or rejected; author cannot self-approve)', category: 'patches' },
  { method: 'POST', path: '/patches/:id/merge', description: 'CAS merge approved patch into a new live version', category: 'deployments' },
  { method: 'POST', path: '/patches/:id/deploy', description: 'Deploy single patch (merges if approved, or deploys directly)', category: 'deployments' },
  { method: 'POST', path: '/patches/:id/undeploy', description: 'Remove patch from live version by creating new version bundle with remaining patches', category: 'deployments' },
  { method: 'POST', path: '/patches/:id/healed', description: 'Content script reports successful fuzzy self-healing match with score & breakdown', category: 'patches' },
  { method: 'GET', path: '/conflicts', description: 'List open conflicts and dynamically detected concurrent patch overlaps', category: 'conflicts' },
  { method: 'POST', path: '/conflicts/:id/resolve', description: 'Resolve conflict by ID with choice (a, b, or custom value)', category: 'conflicts' },
  { method: 'GET', path: '/versions', description: 'List all historical version bundles with parent links and ops snapshots', category: 'deployments' },
  { method: 'GET', path: '/deployments', description: 'List all deployments with canary percentage and rollback timestamps', category: 'deployments' },
  { method: 'GET', path: '/deployments/live', description: 'Active live deployment manifest consumed by the page runtime (Cache-Control: no-store)', category: 'deployments' },
  { method: 'POST', path: '/deploy', description: 'Deploy arbitrary array of patch_ids into a new version and live deployment', category: 'deployments' },
  { method: 'POST', path: '/rollback', description: 'Roll back current live deployment to the most recent earlier deployment', category: 'deployments' },
  { method: 'POST', path: '/deployments/:id/activate', description: 'Reactivate/redeploy an existing historical deployment by ID', category: 'deployments' },
  { method: 'POST', path: '/canary/error', description: 'Report client errors on canary deployment; auto-rolls back if threshold (3) exceeded', category: 'deployments' },
  { method: 'POST', path: '/verify', description: 'Run Playwright + Pixelmatch checkout verification for version_id; auto-rolls back if live', category: 'system' },
  { method: 'POST', path: '/ai/patch', description: 'Generate draft patch from natural-language instruction using Gemini 3.8 Flash (or heuristic fallback)', category: 'patches' },
  { method: 'GET', path: '/audit', description: 'List audit trail events (UUID, actor_id, event_type, entity_id, details, timestamp)', category: 'system' },
];

export const CODEBASE_FACTS = {
  anchorCount: 6,
  anchors: ['cssSelector', 'xpath', 'textContent', 'attributes', 'parentContext', 'siblingContext'],
  changeTypeCount: 8,
  changeTypes: ['text', 'style', 'visibility', 'script', 'attribute', 'remove', 'move', 'behavior'],
  statusCount: 9,
  geminiModel: 'gemini-3.8-flash',
  geminiEffort: 'Default standard generateContent (heuristic rule fallback if no API key)',
  verificationEngine: 'Playwright + Pixelmatch',
  runtimePollingIntervalMs: 2000,
  mutationObserverDebounceMs: 150,
  jaccardHealingThreshold: 0.25,
  anchorTargetingSimilarityThreshold: 0.80,
  canaryErrorThreshold: 3,
};

export function getRouteString(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string): string {
  const ep = REAL_API_ENDPOINTS.find((e) => e.method === method && e.path === path);
  return ep ? `${ep.method} ${ep.path}` : `${method} ${path}`;
}

export const KNOWN_LIMITATIONS = [
  {
    title: 'Fuzzy Healing Mis-targeting',
    description:
      'The token Jaccard similarity threshold (>= 0.25) with synonym normalization (e.g. checkout=order=buy) can heal onto a wrong element if a page layout is substantially restructured with similarly-styled controls.',
  },
  {
    title: 'Script Patch Security & Reversibility',
    description:
      'Patches of type "script" execute arbitrary JavaScript via `new Function` in the page context. They cannot be automatically reverted by DOM undo records, and in the current pipeline are gated only by reviewer approval (disabled by default in extension content scripts).',
  },
  {
    title: 'Reactive Post-Deploy Verification',
    description:
      'Playwright verification runs after deploy or on-demand rather than pre-gating the deployment. If a failing version is released live, the server reacts by triggering an automatic rollback rather than halting the deploy upfront.',
  },
  {
    title: 'In-Memory Store Volatility',
    description:
      'When Supabase credentials are not configured or unreachable, the server falls back to an in-memory store (`storeMode: "memory"`), which loses all patches, versions, and audit history whenever the server restarts.',
  },
];
