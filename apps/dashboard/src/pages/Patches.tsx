import { Fragment, useState, useRef, useEffect } from 'react';
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

export function Patches() {
  const { user: actingUser } = useActingUser();
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
    run(p.id, '✅ No conflicts found! Patch approved — click Deploy to make it live.', async () => {
      const res = await api<{ status: string; rebased?: boolean; auto_approved?: boolean; conflicts?: any[] }>(`/patches/${p.id}/submit`, {
        method: 'POST',
      });
      if (res.status === 'conflicted') {
        throw new Error('⚠️ Conflict detected with another patch! Check the Conflicts page.');
      } else if (res.status === 'stale') {
        throw new Error('⚠️ Could not find the target element on the page. Check the selector.');
      } else if (res.rebased) {
        // Will show the okMessage but also note the rebase
        show('Auto-rebased to latest live version. Patch approved — click Deploy to make it live.');
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
          <h1 className="text-3xl font-bold tracking-tight">Patches</h1>
          <p className="text-sm text-slate-500 mt-1">
            Live on demo site:{' '}
            <strong className="text-slate-800">
              {live?.version ? `version ${live.version.number}, ${live.patches.length} patch(es)` : 'original site (no patches)'}
            </strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Rename "+ New patch" to "+ New website" */}
          <button
            onClick={() => setSiteModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 shadow-sm"
          >
            <Globe className="w-4 h-4" />
            + New website
          </button>
          <a
            href={DEMO_URL}
            target="_blank"
            rel="noreferrer"
            className="border bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 shadow-sm"
          >
            Open demo site
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>
      </div>

      <Notice notice={notice} />
      <ErrorBanner message={patchesQ.error} />

      {/* Sites tab indicator if multiple sites exist */}
      {sitesQ.data && sitesQ.data.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Site:</span>
          <button
            onClick={() => setActiveSiteId(null)}
            className={`px-3 py-1 rounded-full border transition-all ${
              !activeSiteId
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All sites
          </button>
          {sitesQ.data.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSiteId(s.id)}
              className={`px-3 py-1 rounded-full border transition-all ${
                activeSiteId === s.id
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
      <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Patch Repository</h2>
            <span className="text-xs text-slate-400 font-normal">({patches.length})</span>
          </div>
          {/* Secondary entry point for manual patch creation */}
          <button
            onClick={openCreate}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline transition-colors"
          >
            Add patch manually
          </button>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50/75 border-b text-slate-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Title / Element</th>
              <th className="px-4 py-3 font-medium">Change</th>
              <th className="px-4 py-3 font-medium">Value</th>
              <th className="px-4 py-3 font-medium">Author</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {patches.map((patch) => {
              const isLive = liveIds.has(patch.id);
              const busy = busyId === patch.id;
              const heal = healByPatch[patch.id];
              const effectiveStatus = isLive ? 'live' : patch.status;
              const isAuthor = patch.author_id === actingUser.id;

              return (
                <Fragment key={patch.id}>
                  <tr className="border-b hover:bg-slate-50/50 align-middle">
                    {/* Status Badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusPill status={effectiveStatus} />
                    </td>

                    {/* Title & Selector */}
                    <td className="px-4 py-3 max-w-xs">
                      {patch.title ? (
                        <div className="font-semibold text-slate-900 text-xs truncate" title={patch.title}>
                          {patch.title}
                        </div>
                      ) : null}
                      <div className="font-mono text-xs text-slate-500 truncate" title={patch.anchors.cssSelector}>
                        {patch.anchors.cssSelector || '(text search)'}
                      </div>
                      {patch.anchors.textContent && (
                        <div className="text-[11px] text-slate-400 truncate" title={patch.anchors.textContent}>
                          match: "{patch.anchors.textContent}"
                        </div>
                      )}
                    </td>

                    {/* Change Type */}
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{patch.change.type}</td>

                    {/* Value */}
                    <td className="px-4 py-3 max-w-xs break-words text-xs">{patch.change.value}</td>

                    {/* Author */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-slate-600">
                      {getUserName(patch.author_id)}
                      {isAuthor && <span className="ml-1 text-[10px] text-indigo-600 font-bold">(You)</span>}
                    </td>

                    {/* Actions — right aligned with icons flush right */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        {/* Status workflow actions */}
                        <a
                          href={`${DEMO_URL}/?preview_patch=${patch.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-2 py-1 rounded text-xs font-semibold"
                          title="Open the demo site with only this patch previewed"
                        >
                          Preview
                        </a>

                        {effectiveStatus === 'draft' && (
                          <button
                            disabled={busy}
                            onClick={() => submitPatch(patch)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1"
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
                                className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium"
                                title="An author cannot approve their own patch"
                              >
                                Awaiting review
                              </span>
                            ) : (
                              <div className="inline-flex gap-1">
                                <button
                                  disabled={busy}
                                  onClick={() => reviewPatch(patch, 'approved')}
                                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-1 rounded text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-0.5"
                                  title="Approve this patch"
                                >
                                  <Check className="w-3 h-3" />
                                  Approve
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() => reviewPatch(patch, 'rejected')}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-1 rounded text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-0.5"
                                  title="Reject this patch"
                                >
                                  <X className="w-3 h-3" />
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
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-xs font-semibold disabled:opacity-50 shadow-sm"
                            title="Deploy and merge into live version"
                          >
                            {busy ? 'Deploying...' : 'Deploy'}
                          </button>
                        )}

                        {effectiveStatus === 'live' && (
                          <button
                            disabled={busy}
                            onClick={() => rollback(patch)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded text-xs font-semibold disabled:opacity-50"
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

                        {heal && (
                          <button
                            onClick={() => setExpanded(expanded === patch.id ? null : patch.id)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-semibold underline"
                          >
                            Why healed?
                          </button>
                        )}

                        {/* Right-aligned Icon Buttons: Edit & Delete */}
                        <div className="inline-flex items-center gap-1 pl-2 border-l border-slate-200">
                          <button
                            onClick={() => openEdit(patch)}
                            aria-label="Edit"
                            title="Edit"
                            className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => remove(patch)}
                            aria-label="Delete"
                            title="Delete"
                            className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
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
    live: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    approved: 'bg-purple-100 text-purple-800 border border-purple-300',
    in_review: 'bg-amber-100 text-amber-800 border border-amber-300',
    draft: 'bg-slate-100 text-slate-700 border border-slate-300',
    conflicted: 'bg-rose-100 text-rose-800 border border-rose-300',
    rejected: 'bg-red-100 text-red-800 border border-red-300',
    stale: 'bg-orange-100 text-orange-800 border border-orange-300',
    broken: 'bg-red-100 text-red-700 border border-red-200',
    healed: 'bg-blue-100 text-blue-700 border border-blue-200',
  };
  const style = badgeClasses[status] || 'bg-slate-100 text-slate-700 border border-slate-200';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize tracking-wide ${style}`}>
      {status.replace(/_/g, ' ')}
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
      // Step 1: Submit (validates + auto-approves if no conflicts)
      const submitRes = await api<{ status: string; auto_approved?: boolean }>(`/patches/${pendingPatch.id}/submit`, {
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
      // Step 2: Deploy
      await api(`/patches/${pendingPatch.id}/deploy`, { method: 'POST' });
      setPendingPatch(null);
      setContext('');
      await onCreated('🚀 Patch is now live! Reload the demo site to see your change.');
    } catch (e: any) {
      onError(e.message);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-bold text-indigo-800">Natural language patch (AI)</h3>
      <textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder={'Paste the element\'s HTML (optional), e.g. <h3 class="product-title">Smart Watch</h3>'}
        rows={2}
        className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 ring-indigo-300 outline-none"
      />
      <div className="flex gap-2">
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && generate()}
          placeholder='e.g. "Change the logo text to SuperStore" or "Make the checkout button green"'
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 ring-indigo-300 outline-none"
        />
        <button
          onClick={generate}
          disabled={loading || !instruction.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate patch'}
        </button>
      </div>

      {/* Inline Submit & Deploy — shown immediately after draft creation */}
      {pendingPatch && (
        <div className="flex items-center justify-between gap-3 bg-indigo-100 border border-indigo-300 rounded-lg px-4 py-3">
          <div className="text-sm text-indigo-900">
            <span className="font-semibold">Draft ready</span>
            {pendingPatch.title && (
              <span className="ml-1 text-indigo-700">· {pendingPatch.title}</span>
            )}
            <span className="ml-2 font-mono text-indigo-500 text-xs">({pendingPatch.id.slice(0, 8)})</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPendingPatch(null)}
              className="text-xs text-indigo-600 hover:underline"
            >
              Dismiss
            </button>
            <button
              onClick={submitAndDeploy}
              disabled={deploying}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              {deploying ? (
                <span>Deploying...</span>
              ) : (
                <><span>🚀</span><span>Submit & Deploy</span></>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
