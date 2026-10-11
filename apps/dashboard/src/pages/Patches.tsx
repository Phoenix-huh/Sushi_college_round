import { Fragment, useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Pencil, Trash2, Globe, ExternalLink, GitCommit, Check, X, Send } from 'lucide-react';
import type { Patch, AuditEvent, Site } from '@patchwork/shared';
import { api, usePolling, DEMO_URL, useActingUser, getUserName } from '../lib/api';
import { ErrorBanner, Notice, useNotice } from '../components/Notice';

interface LiveState {
  deployment: { id: string } | null;
  version: { number: number } | null;
  patches: Patch[];
  signature: string;
}

interface ConflictsResponse {
  hasConflict: boolean;
  conflictingPatches: [Patch, Patch][];
  conflicts?: Array<{ id: string; patch_a: string; patch_b: string }>;
}

type FormState = { title: string; type: string; value: string; selector: string; text: string };
const EMPTY_FORM: FormState = { title: '', type: 'text', value: '', selector: '', text: '' };
const TEXT_SEARCH_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, span, a, button, label, li, td, th, strong, em, b, small, div';

/** Convert a raw change value to a short, human-readable description. */
function formatChangeValue(type: string, value: string): string {
  try {
    if (type === 'attribute') {
      const av = JSON.parse(value) as { name?: string; value?: string; remove?: boolean };
      if (av.remove) return `remove attr: ${av.name}`;
      return `${av.name} = "${av.value}"`;
    }
    if (type === 'move') {
      const mv = JSON.parse(value) as { to?: string; ref?: { cssSelector?: string } };
      const sel = mv.ref?.cssSelector ?? '?';
      return `${mv.to ?? '?'} relative to: ${sel.length > 30 ? sel.slice(0, 30) + '…' : sel}`;
    }
    if (type === 'behavior') {
      const bv = JSON.parse(value) as { action?: string; url?: string; message?: string };
      if (bv.action === 'navigate') return `click → navigate to ${bv.url ?? '?'}`;
      if (bv.action === 'confirm') return `click → confirm: "${bv.message ?? '?'}"`;
      if (bv.action === 'disable') return 'click → disable element';
      if (bv.action === 'toggle') return 'click → toggle element';
      if (bv.action === 'scroll_to') return 'click → scroll to element';
      return `behavior: ${bv.action ?? '?'}`;
    }
    if (type === 'remove') return '🗑 Remove element from DOM';
    if (type === 'visibility') return value === 'hidden' || value === 'hide' ? '👁 Hide element' : '👁 Show element';
  } catch {
    // fall through to raw value
  }
  // Text/style or unknown — truncate long values
  return value.length > 60 ? value.slice(0, 60) + '…' : value;
}



export function Patches() {
  const { user: actingUser } = useActingUser();
  const outlet = useOutletContext<{ role: 'developer' | 'reviewer' } | null>();
  const role = outlet?.role ?? 'developer';
  const patchesQ = usePolling(() => api<Patch[]>('/patches'), 3000);
  const liveQ = usePolling(() => api<LiveState>('/deployments/live'), 3000);
  const auditQ = usePolling(() => api<AuditEvent[]>('/audit'), 5000);
  const conflictsQ = usePolling(() => api<ConflictsResponse>('/conflicts'), 3000);
  const sitesQ = usePolling(() => api<Site[]>('/sites'), 5000);
  const { notice, show } = useNotice();

  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; patch: Patch } | null>(null);
  const [siteModal, setSiteModal] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState(DEMO_URL);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Notify when a teammate creates a conflicting patch
  const knownConflictIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!conflictsQ.data) return;
    const currentPairs = conflictsQ.data.conflictingPatches || [];
    const currentKeys = new Set(
      currentPairs.map(([a, b]) => [a.id, b.id].sort().join(':'))
    );
    if (knownConflictIdsRef.current !== null) {
      for (const k of currentKeys) {
        if (!knownConflictIdsRef.current.has(k)) {
          show('A teammate created a conflicting patch! Check the Conflicts page.', 'error');
          break;
        }
      }
    }
    knownConflictIdsRef.current = currentKeys;
  }, [conflictsQ.data, show]);

  const allPatches = patchesQ.data ?? [];
  const patches = activeSiteId
    ? allPatches.filter((p) => !p.site_id || p.site_id === activeSiteId)
    : allPatches;
  const live = liveQ.data;
  const liveIds = new Set((live?.patches ?? []).map((p) => p.id));
  const healByPatch: Record<string, AuditEvent> = {};
  for (const e of auditQ.data ?? []) {
    if (e.event_type === 'patch_healed' && !healByPatch[e.entity_id]) healByPatch[e.entity_id] = e;
  }

  const refreshAll = async () => {
    await Promise.all([patchesQ.refresh(), liveQ.refresh(), auditQ.refresh(), conflictsQ.refresh(), sitesQ.refresh()]);
  };

  const run = async (id: string, okMessage: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await fn();
      show(okMessage);
      await refreshAll();
    } catch (e: any) {
      show(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const deploy = (p: Patch) =>
    run(p.id, '🚀 Deployed! Reload the demo site to see your change.', () =>
      api(`/patches/${p.id}/deploy`, { method: 'POST' }));

  const rollback = (p: Patch) => {
    if (!window.confirm('Roll back this patch from the live site?')) return;
    void run(p.id, 'Rolled back.', () => api(`/patches/${p.id}/undeploy`, { method: 'POST' }));
  };

  const submitPatch = (p: Patch) =>
    run(p.id, '📋 Patch submitted for review. A reviewer must approve it before it can be deployed.', async () => {
      const res = await api<{ status: string; rebased?: boolean; conflicts?: any[] }>(`/patches/${p.id}/submit`, {
        method: 'POST',
      });
      if (res.status === 'conflicted') {
        throw new Error('⚠️ Conflict detected with another patch! Check the Conflicts page.');
      } else if (res.status === 'stale') {
        throw new Error('⚠️ Could not find the target element on the page. Check the selector.');
      } else if (res.rebased) {
        show('Auto-rebased to latest live version. Patch is now in review — a reviewer must approve it.');
      }
    });

  const reviewPatch = (p: Patch, decision: 'approved' | 'rejected') => {
    if (p.author_id === actingUser.id && decision === 'approved') {
      show('Authors cannot approve their own patches.', 'error');
      return;
    }
    void run(p.id, decision === 'approved' ? 'Patch approved.' : 'Patch rejected.', () =>
      api(`/patches/${p.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      })
    );
  };

  const remove = (p: Patch) => {
    if (!window.confirm('Delete this patch? If it is live it is rolled back too.')) return;
    void run(p.id, 'Patch deleted.', () => api(`/patches/${p.id}`, { method: 'DELETE' }));
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setModal({ mode: 'create' });
  };

  const openEdit = (patch: Patch) => {
    setForm({
      title: patch.title ?? '',
      type: patch.change.type,
      value: patch.change.value,
      selector: patch.anchors.cssSelector,
      text: patch.anchors.textContent ?? '',
    });
    setModal({ mode: 'edit', patch });
  };

  const save = async () => {
    if (!modal) return;
    const selector = form.selector.trim();
    const text = form.text.trim();
    if (!selector && !text) {
      show('Enter a CSS selector, or the exact text of the element to change.', 'error');
      return;
    }
    const byTextOnly = !selector;
    try {
      if (modal.mode === 'edit') {
        await api(`/patches/${modal.patch.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: form.title.trim() || undefined,
            change: { type: form.type, value: form.value },
            anchors: { cssSelector: selector || TEXT_SEARCH_SELECTOR, textContent: text },
          }),
        });
        show(liveIds.has(modal.patch.id) ? 'Saved. This patch is live, so the demo site updates shortly.' : 'Saved.');
      } else {
        await api('/patches', {
          method: 'POST',
          body: JSON.stringify({
            title: form.title.trim() || undefined,
            site_id: activeSiteId || undefined,
            target_url: `${DEMO_URL}/`,
            base_version: live?.version?.number ?? 0,
            anchors: {
              cssSelector: selector || TEXT_SEARCH_SELECTOR,
              xpath: '',
              textContent: text,
              attributes: byTextOnly ? { 'pw-find': 'text' } : {},
              parentContext: '',
              siblingContext: [],
            },
            change: { type: form.type, value: form.value },
            author_id: actingUser.id,
          }),
        });
        show('Draft patch created. Submit it for review or preview it.');
      }
      setModal(null);
      await refreshAll();
    } catch (e: any) {
      show(e.message, 'error');
    }
  };

  const createWebsite = async () => {
    if (!newSiteName.trim() || !newSiteUrl.trim()) {
      show('Please provide a website name and URL.', 'error');
      return;
    }
    try {
      const created = await api<Site>('/sites', {
        method: 'POST',
        body: JSON.stringify({ name: newSiteName.trim(), url: newSiteUrl.trim() }),
      });
      setActiveSiteId(created.id);
      setSiteModal(false);
      setNewSiteName('');
      show(`Created website "${created.name}" and made it active.`);
      await refreshAll();
    } catch (e: any) {
      show(e.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight text-white">Patches</h1>
          <p className="text-sm font-mono text-on-surface-variant mt-1">
            Live on demo site:{' '}
            <strong className="text-primary font-bold">
              {live?.version ? `version ${live.version.number}, ${live.patches.length} patch(es)` : 'original site (no patches)'}
            </strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Rename "+ New patch" to "+ New website" */}
          <button
            onClick={() => setSiteModal(true)}
            className="bg-primary-container hover:bg-[#ff1e70] text-white px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Globe className="w-4 h-4" />
            + New website
          </button>
        </div>
      </div>

      <Notice notice={notice} />
      <ErrorBanner message={patchesQ.error} />

      {/* Sites tab indicator if multiple sites exist */}
      {sitesQ.data && sitesQ.data.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
          <span className="text-outline font-semibold uppercase text-[10px] tracking-wider">Site:</span>
          <button
            onClick={() => setActiveSiteId(null)}
            className={`px-3 py-1 rounded-full border transition-all text-xs ${
              !activeSiteId
                ? 'bg-primary-container/20 border-primary-container text-white font-bold shadow-[0_0_12px_rgba(255,59,129,0.3)]'
                : 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:text-white'
            }`}
          >
            All sites
          </button>
          {sitesQ.data.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSiteId(s.id)}
              className={`px-3 py-1 rounded-full border transition-all text-xs ${
                activeSiteId === s.id
                  ? 'bg-primary-container/20 border-primary-container text-white font-bold shadow-[0_0_12px_rgba(255,59,129,0.3)]'
                  : 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:text-white'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Natural Language Prompt Box */}
      <NLPromptBox
        onCreated={async (msg) => {
          show(msg);
          await refreshAll();
        }}
        onError={(m) => show(m, 'error')}
      />

      {/* Patches Table */}
      <div className="cyber-glass rounded-xl border border-outline-variant/30 shadow-lg overflow-x-auto">
        <div className="px-4 py-3.5 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container/60">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-headline font-bold text-white uppercase tracking-wider">Patch Repository</h2>
            <span className="text-xs font-mono text-outline">({patches.length})</span>
          </div>
          {/* Secondary entry point for manual patch creation */}
          <button
            onClick={openCreate}
            className="text-xs font-mono font-bold text-primary hover:text-white underline transition-colors"
          >
            + Add patch manually
          </button>
        </div>
        <table className="w-full text-xs font-mono text-left min-w-[920px]">
          <thead className="bg-surface-container-highest/50 border-b border-outline-variant/30 text-outline uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3 font-medium w-24">Status</th>
              <th className="px-4 py-3 font-medium w-72 max-w-sm">Title / Element</th>
              <th className="px-4 py-3 font-medium w-20">Change</th>
              <th className="px-4 py-3 font-medium max-w-md">Value</th>
              <th className="px-4 py-3 font-medium w-28 whitespace-nowrap">Author</th>
              <th className="px-4 py-3 pr-6 font-medium text-right min-w-[220px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {patches.map((patch) => {
              const isLive = liveIds.has(patch.id);
              const busy = busyId === patch.id;
              const heal = healByPatch[patch.id];
              const effectiveStatus = isLive ? 'live' : patch.status;
              const isAuthor = patch.author_id === actingUser.id;

              return (
                <Fragment key={patch.id}>
                  <tr className="hover:bg-surface-container/40 align-middle transition-colors">
                    {/* Status Badge */}
                    <td className="px-4 py-3 whitespace-nowrap w-24">
                      <StatusPill status={effectiveStatus} />
                    </td>

                    {/* Title & Selector */}
                    <td className="px-4 py-3 w-72 max-w-sm">
                      {patch.title ? (
                        <div className="font-semibold text-white text-xs truncate" title={patch.title}>
                          {patch.title}
                        </div>
                      ) : null}
                      <div className="font-mono text-xs text-primary truncate" title={patch.anchors.cssSelector}>
                        {patch.anchors.cssSelector || '(text search)'}
                      </div>
                      {patch.anchors.textContent && (
                        <div className="text-[11px] text-outline truncate" title={patch.anchors.textContent}>
                          match: "{patch.anchors.textContent}"
                        </div>
                      )}
                    </td>

                    {/* Change Type */}
                    <td className="px-4 py-3 font-mono text-xs text-outline-variant whitespace-nowrap w-20">
                      <span className="bg-surface-container px-1.5 py-0.5 rounded border border-outline-variant/30 text-on-surface">
                        {patch.change.type}
                      </span>
                    </td>

                    {/* Value */}
                    <td className="px-4 py-3 max-w-md">
                      <div
                        className="font-mono text-xs text-on-surface max-w-md break-all line-clamp-2 bg-surface-container/40 px-2 py-1 rounded border border-outline-variant/20 hover:line-clamp-none transition-all cursor-pointer"
                        title={patch.change.value}
                      >
                        {formatChangeValue(patch.change.type, patch.change.value)}
                      </div>
                    </td>

                    {/* Author */}
                    <td className="px-4 py-3 whitespace-nowrap w-28 text-xs font-mono text-on-surface-variant">
                      {getUserName(patch.author_id)}
                      {isAuthor && <span className="ml-1 text-[10px] text-primary font-bold">(You)</span>}
                    </td>

                    {/* Actions — right aligned with icons flush right */}
                    <td className="px-4 py-3 pr-6 text-right whitespace-nowrap min-w-[220px]">
                      <div className="inline-flex items-center justify-end gap-2 min-w-max">
                        {/* Status workflow actions */}
                        <a
                          href={`${DEMO_URL}/?preview_patch=${patch.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-surface-container hover:bg-surface-container-high text-white border border-outline-variant/40 px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-colors"
                          title="Open the demo site with only this patch previewed"
                        >
                          Preview
                        </a>

                        {effectiveStatus === 'draft' && (
                          <button
                            disabled={busy}
                            onClick={() => submitPatch(patch)}
                            className="bg-primary-container/20 hover:bg-primary-container/30 text-primary border border-primary-container/50 px-2.5 py-1 rounded-md text-xs font-mono font-bold disabled:opacity-50 inline-flex items-center gap-1 transition-all"
                            title="Submit this patch for review and check for conflicts"
                          >
                            <Send className="w-3 h-3" />
                            Submit
                          </button>
                        )}

                        {effectiveStatus === 'in_review' && (
                          <>
                            {isAuthor ? (
                              <span
                                className="text-xs text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded font-mono font-medium"
                                title="An author cannot approve their own patch"
                              >
                                Awaiting review
                              </span>
                            ) : role !== 'reviewer' ? (
                              <span
                                className="text-xs text-on-surface-variant bg-surface-container border border-outline-variant/40 px-2 py-0.5 rounded font-mono"
                                title="Switch your role to Reviewer (bottom-left) to approve or reject this patch"
                              >
                                In review (Reviewer only)
                              </span>
                            ) : (
                              <div className="inline-flex gap-1.5 items-center">
                                <button
                                  disabled={busy}
                                  onClick={() => reviewPatch(patch, 'approved')}
                                  className="bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/60 px-2.5 py-1 rounded text-xs font-mono font-bold disabled:opacity-50 inline-flex items-center gap-1 shadow-sm transition-all"
                                  title="Approve this patch"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Approve
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() => reviewPatch(patch, 'rejected')}
                                  className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/60 px-2.5 py-1 rounded text-xs font-mono font-bold disabled:opacity-50 inline-flex items-center gap-1 shadow-sm transition-all"
                                  title="Reject this patch"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Reject
                                </button>
                              </div>
                            )}
                          </>
                        )}

                        {effectiveStatus === 'approved' && (
                          <button
                            disabled={busy}
                            onClick={() => deploy(patch)}
                            className="bg-primary-container hover:bg-[#ff1e70] text-white px-3 py-1 rounded text-xs font-mono font-bold uppercase tracking-wider disabled:opacity-50 shadow-sm transition-all"
                            title="Deploy and merge into live version"
                          >
                            {busy ? 'Deploying...' : 'Deploy'}
                          </button>
                        )}

                        {effectiveStatus === 'live' && (
                          <button
                            disabled={busy}
                            onClick={() => rollback(patch)}
                            className="bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-500/50 px-2.5 py-1 rounded text-xs font-mono font-semibold disabled:opacity-50 transition-all"
                            title="Roll back this patch from the live site"
                          >
                            Roll back
                          </button>
                        )}

                        {effectiveStatus === 'conflicted' && (
                          <a
                            href="/conflicts"
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-1 rounded text-xs font-semibold inline-flex items-center gap-1"
                            title="Resolve conflict on the Conflicts page"
                          >
                            <GitCommit className="w-3 h-3" />
                            View conflict
                          </a>
                        )}


                        {/* Right-aligned Icon Buttons: Edit & Delete */}
                        <div className="inline-flex items-center gap-1 pl-2 border-l border-outline-variant/30">
                          <button
                            onClick={() => openEdit(patch)}
                            aria-label="Edit"
                            title="Edit"
                            className="p-1 rounded text-outline hover:text-primary hover:bg-surface-container transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => remove(patch)}
                            aria-label="Delete"
                            title="Delete"
                            className="p-1 rounded text-outline hover:text-rose-400 hover:bg-rose-950/40 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {heal && expanded === patch.id && (
                    <tr className="bg-blue-50/60 border-b">
                      <td colSpan={6} className="px-6 py-3">
                        <ScoreBreakdown details={heal.details} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!patchesQ.loading && patches.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  No patches yet. Click "Add patch manually" or generate one with AI above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: New Website */}
      {siteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-600" />
                Add New Website
              </h3>
              <button onClick={() => setSiteModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">
                Close
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Website Name</span>
                <input
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  placeholder="e.g. Production Store, Staging Site"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 ring-indigo-300 outline-none"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Website URL</span>
                <input
                  value={newSiteUrl}
                  onChange={(e) => setNewSiteUrl(e.target.value)}
                  placeholder="e.g. http://localhost:4100/"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 ring-indigo-300 outline-none"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setSiteModal(false)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={createWebsite} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">
                Create Website
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create or Edit Patch */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">{modal.mode === 'create' ? 'New patch' : 'Edit patch'}</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">
                Close
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Patch Title (optional)</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Checkout Button Coral Color"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 ring-indigo-300 outline-none"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Target CSS selector</span>
                <input
                  value={form.selector}
                  onChange={(e) => setForm({ ...form, selector: e.target.value })}
                  placeholder="e.g. #checkout-btn, .logo, .product-title (or leave empty)"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 ring-indigo-300 outline-none"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Element's current text (optional)</span>
                <input
                  value={form.text}
                  onChange={(e) => setForm({ ...form, text: e.target.value })}
                  placeholder="e.g. Smart Watch"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 ring-indigo-300 outline-none"
                />
                <span className="block text-[11px] text-slate-500 mt-1">
                  Use this when the selector matches several elements (like three .product-title). Leave the selector empty to find the element by its text alone.
                </span>
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Change type</span>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 ring-indigo-300 outline-none"
                >
                  <option value="text">text</option>
                  <option value="style">style</option>
                  <option value="visibility">visibility (hidden / visible)</option>
                  <option value="script">script</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Value</span>
                <textarea
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  rows={3}
                  placeholder={
                    form.type === 'style'
                      ? 'background-color: #ef4444; color: white;'
                      : form.type === 'visibility'
                      ? 'hidden'
                      : form.type === 'script'
                      ? 'target.textContent = "Hi";'
                      : 'New text'
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 ring-indigo-300 outline-none"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setModal(null)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={save} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">
                {modal.mode === 'create' ? 'Create draft' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const badgeClasses: Record<string, string> = {
    live: 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/50',
    approved: 'bg-purple-950/60 text-purple-300 border border-purple-500/50',
    in_review: 'bg-amber-950/60 text-amber-300 border border-amber-500/50',
    draft: 'bg-surface-container-high text-on-surface-variant border border-outline-variant/40',
    conflicted: 'bg-rose-950/60 text-rose-300 border border-rose-500/50',
    rejected: 'bg-red-950/60 text-red-300 border border-red-500/50',
    stale: 'bg-orange-950/60 text-orange-300 border border-orange-500/50',
    broken: 'bg-red-950/60 text-red-300 border border-red-500/50',
    healed: 'bg-sky-950/60 text-sky-300 border border-sky-500/50',
  };
  const style = badgeClasses[status] || 'bg-surface-container text-on-surface-variant border border-outline-variant/40';
  const label = status === 'healed' ? '⟡ auto-healed' : status.replace(/_/g, ' ');
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${style}`}>
      {label}
    </span>
  );
}

function ScoreBreakdown({ details }: { details: Record<string, unknown> }) {
  const breakdown = details.breakdown as Record<string, number> | undefined;
  const score = details.score as number | undefined;
  return (
    <div className="text-sm space-y-2">
      {score !== undefined && (
        <p className="text-blue-700">
          Overall confidence: <strong>{(score * 100).toFixed(1)}%</strong>
        </p>
      )}
      {breakdown && (
        <div className="flex gap-3 flex-wrap">
          {Object.entries(breakdown).map(([key, val]) => (
            <div key={key} className="bg-white border border-blue-200 rounded px-3 py-1 text-xs">
              <span className="text-slate-500 capitalize">{key}: </span>
              <span className="font-semibold text-blue-800">{(val * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NLPromptBox({
  onCreated,
  onError,
}: {
  onCreated: (msg: string) => Promise<void>;
  onError: (m: string) => void;
}) {
  const [instruction, setInstruction] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingPatch, setPendingPatch] = useState<{ id: string; title?: string } | null>(null);
  const [deploying, setDeploying] = useState(false);

  const generate = async () => {
    if (!instruction.trim() || loading) return;
    setLoading(true);
    setPendingPatch(null);
    try {
      const data = await api<{ draft?: { id: string; title?: string } }>('/ai/patch', {
        method: 'POST',
        body: JSON.stringify({ instruction, element_context: context, target_url: `${DEMO_URL}/` }),
      });
      if (data.draft) {
        setPendingPatch(data.draft);
        setInstruction('');
        await onCreated(`Draft created. Review the selector below, then click Submit & Deploy.`);
      } else {
        await onCreated('Draft created. Find it in the table below.');
      }
    } catch (e: any) {
      onError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const submitAndDeploy = async () => {
    if (!pendingPatch) return;
    setDeploying(true);
    try {
      // Submit (conflict check + rebase) — now moves to in_review, not auto-approve
      const submitRes = await api<{ status: string }>(`/patches/${pendingPatch.id}/submit`, {
        method: 'POST',
      });
      if (submitRes.status === 'conflicted') {
        onError('⚠️ Conflict detected with another patch! Check the Conflicts page.');
        setPendingPatch(null);
        return;
      }
      if (submitRes.status === 'stale') {
        onError('⚠️ Target element not found on the page. Edit the patch in the table below.');
        setPendingPatch(null);
        return;
      }
      // Patch is now in_review — inform the user
      setPendingPatch(null);
      setContext('');
      await onCreated('📋 AI patch submitted for review. Switch users and approve it, then click Deploy.');
    } catch (e: any) {
      onError(e.message);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="cyber-glass border border-outline-variant/30 rounded-xl p-5 space-y-3 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-primary-container animate-ping" />
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-primary">Natural language patch (AI)</h3>
      </div>
      <textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder={'Paste the element\'s HTML (optional), e.g. <h3 class="product-title">Smart Watch</h3>'}
        rows={2}
        className="w-full bg-surface-container-lowest/80 border border-outline-variant/40 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-primary-container outline-none"
      />
      <div className="flex gap-2">
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && generate()}
          placeholder='e.g. "Change the logo text to SuperStore" or "Make the checkout button green"'
          className="flex-1 bg-surface-container-lowest/80 border border-outline-variant/40 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-primary-container outline-none"
        />
        <button
          onClick={generate}
          disabled={loading || !instruction.trim()}
          className="bg-primary-container hover:bg-[#ff1e70] text-white px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider disabled:opacity-50 transition-all shadow-sm"
        >
          {loading ? 'Generating...' : 'Generate patch'}
        </button>
      </div>

      {/* Inline Submit & Deploy — shown immediately after draft creation */}
      {pendingPatch && (
        <div className="flex items-center justify-between gap-3 bg-primary-container/20 border border-primary-container/50 rounded-lg px-4 py-3">
          <div className="text-xs font-mono text-white">
            <span className="font-bold text-primary">Draft ready</span>
            {pendingPatch.title && (
              <span className="ml-1 text-on-surface">· {pendingPatch.title}</span>
            )}
            <span className="ml-2 font-mono text-outline text-[11px]">({pendingPatch.id.slice(0, 8)})</span>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setPendingPatch(null)}
              className="text-xs font-mono text-outline hover:text-white transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={submitAndDeploy}
              disabled={deploying}
              className="bg-primary-container hover:bg-[#ff1e70] text-white px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-all"
            >
              {deploying ? (
                <span>Submitting...</span>
              ) : (
                <><span>📋</span><span>Submit for Review</span></>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
