import { Fragment, useState } from 'react';
import type { Patch, AuditEvent } from '@patchwork/shared';
import { api, usePolling, DEMO_URL, DEV_ID } from '../lib/api';
import { ErrorBanner, Notice, useNotice } from '../components/Notice';

interface LiveState {
  deployment: { id: string } | null;
  version: { number: number } | null;
  patches: Patch[];
  signature: string;
}

type FormState = { type: string; value: string; selector: string; text: string };
const EMPTY_FORM: FormState = { type: 'text', value: '', selector: '', text: '' };
// Same list the server uses when an element is identified by its text only.
const TEXT_SEARCH_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, span, a, button, label, li, td, th, strong, em, b, small, div';

export function Patches() {
  const patchesQ = usePolling(() => api<Patch[]>('/patches'));
  const liveQ = usePolling(() => api<LiveState>('/deployments/live'));
  const auditQ = usePolling(() => api<AuditEvent[]>('/audit'), 5000);
  const { notice, show } = useNotice();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [showSite, setShowSite] = useState(true);
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; patch: Patch } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [expanded, setExpanded] = useState<string | null>(null);

  const patches = patchesQ.data ?? [];
  const live = liveQ.data;
  const liveIds = new Set((live?.patches ?? []).map((p) => p.id));
  const healByPatch: Record<string, AuditEvent> = {};
  for (const e of auditQ.data ?? []) {
    if (e.event_type === 'patch_healed' && !healByPatch[e.entity_id]) healByPatch[e.entity_id] = e;
  }

  const refreshAll = async () => { await Promise.all([patchesQ.refresh(), liveQ.refresh(), auditQ.refresh()]); };

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
    run(p.id, 'Deployed. The demo site picks it up within a couple of seconds.', () =>
      api(`/patches/${p.id}/deploy`, { method: 'POST' }));
  const undeploy = (p: Patch) =>
    run(p.id, 'Removed from the live site.', () => api(`/patches/${p.id}/undeploy`, { method: 'POST' }));
  const remove = (p: Patch) => {
    if (!window.confirm('Delete this patch? If it is live it is removed from the site too.')) return;
    void run(p.id, 'Patch deleted.', () => api(`/patches/${p.id}`, { method: 'DELETE' }));
  };

  const openCreate = () => { setForm(EMPTY_FORM); setModal({ mode: 'create' }); };
  const openEdit = (patch: Patch) => {
    setForm({ type: patch.change.type, value: patch.change.value, selector: patch.anchors.cssSelector, text: patch.anchors.textContent ?? '' });
    setModal({ mode: 'edit', patch });
  };

  const save = async () => {
    if (!modal) return;
    const selector = form.selector.trim();
    const text = form.text.trim();
    if (!selector && !text) { show('Enter a CSS selector, or the exact text of the element to change.', 'error'); return; }
    const byTextOnly = !selector; // no selector: find the element by its text
    try {
      if (modal.mode === 'edit') {
        await api(`/patches/${modal.patch.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            change: { type: form.type, value: form.value },
            anchors: { cssSelector: selector || TEXT_SEARCH_SELECTOR, textContent: text },
          }),
        });
        show(liveIds.has(modal.patch.id)
          ? 'Saved. This patch is live, so the demo site updates shortly.'
          : 'Saved.');
      } else {
        await api('/patches', {
          method: 'POST',
          body: JSON.stringify({
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
            author_id: DEV_ID,
          }),
        });
        show('Draft patch created. Preview it, then Deploy.');
      }
      setModal(null);
      await refreshAll();
    } catch (e: any) {
      show(e.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
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
        <div className="flex gap-2">
          <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + New patch
          </button>
          <a href={DEMO_URL} target="_blank" rel="noreferrer" className="border bg-white hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium">
            Open demo site
          </a>
        </div>
      </div>

      <Notice notice={notice} />
      <ErrorBanner message={patchesQ.error} />

      {/* The real demo site, embedded. It reloads itself when the live version changes. */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <button
          onClick={() => setShowSite((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-50 border-b"
        >
          <span>Live demo site</span>
          <span className="text-xs font-normal text-slate-500">{showSite ? 'hide' : 'show'}</span>
        </button>
        {showSite && <iframe title="Live demo site" src={`${DEMO_URL}/`} className="w-full h-[420px] bg-white" />}
      </div>

      <NLPromptBox
        onCreated={async (msg) => { show(msg); await refreshAll(); }}
        onError={(m) => show(m, 'error')}
      />

      <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b text-slate-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Change</th>
              <th className="px-4 py-3 font-medium">Value</th>
              <th className="px-4 py-3 font-medium">Selector</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {patches.map((patch) => {
              const isLive = liveIds.has(patch.id);
              const busy = busyId === patch.id;
              const heal = healByPatch[patch.id];
              return (
                <Fragment key={patch.id}>
                  <tr className="border-b hover:bg-slate-50/50 align-top">
                    <td className="px-4 py-3">
                      <StatusPill status={isLive ? 'live' : patch.status} />
                    </td>
                    <td className="px-4 py-3 font-mono">{patch.change.type}</td>
                    <td className="px-4 py-3 max-w-xs break-words">{patch.change.value}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{patch.anchors.cssSelector}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`${DEMO_URL}/?preview_patch=${patch.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-2.5 py-1 rounded text-xs font-semibold"
                          title="Open the demo site with only this draft applied (nothing goes live)"
                        >
                          Preview
                        </a>
                        {isLive ? (
                          <button disabled={busy} onClick={() => undeploy(patch)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded text-xs font-semibold disabled:opacity-50">
                            Remove from live
                          </button>
                        ) : (
                          <button disabled={busy} onClick={() => deploy(patch)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded text-xs font-semibold disabled:opacity-50">
                            {busy ? 'Deploying...' : 'Deploy'}
                          </button>
                        )}
                        <button onClick={() => openEdit(patch)} className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline">
                          Edit
                        </button>
                        <button disabled={busy} onClick={() => remove(patch)} className="text-red-600 hover:text-red-800 text-xs font-semibold underline disabled:opacity-50">
                          Delete
                        </button>
                        {heal && (
                          <button onClick={() => setExpanded(expanded === patch.id ? null : patch.id)} className="text-blue-600 text-xs font-semibold underline">
                            Why healed?
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {heal && expanded === patch.id && (
                    <tr className="bg-blue-50/60 border-b">
                      <td colSpan={5} className="px-6 py-3"><ScoreBreakdown details={heal.details} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!patchesQ.loading && patches.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No patches yet. Create one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">{modal.mode === 'create' ? 'New patch' : 'Edit patch'}</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">Close</button>
            </div>
            <div className="space-y-3 text-sm">
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
                    form.type === 'style' ? 'background-color: #ef4444; color: white;'
                    : form.type === 'visibility' ? 'hidden'
                    : form.type === 'script' ? 'target.textContent = "Hi";'
                    : 'New text'
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 ring-indigo-300 outline-none"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setModal(null)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
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
  const style =
    status === 'live' ? 'bg-emerald-100 text-emerald-700'
    : status === 'healed' ? 'bg-blue-100 text-blue-700'
    : status === 'broken' ? 'bg-red-100 text-red-700'
    : status === 'approved' ? 'bg-violet-100 text-violet-700'
    : 'bg-slate-100 text-slate-700';
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>{status}</span>;
}

function ScoreBreakdown({ details }: { details: Record<string, unknown> }) {
  const breakdown = details.breakdown as Record<string, number> | undefined;
  const score = details.score as number | undefined;
  return (
    <div className="text-sm space-y-2">
      {score !== undefined && (
        <p className="text-blue-700">Overall confidence: <strong>{(score * 100).toFixed(1)}%</strong></p>
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

function NLPromptBox({ onCreated, onError }: { onCreated: (msg: string) => Promise<void>; onError: (m: string) => void }) {
  const [instruction, setInstruction] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!instruction.trim() || loading) return;
    setLoading(true);
    try {
      const data = await api<{ draft?: Patch }>('/ai/patch', {
        method: 'POST',
        body: JSON.stringify({ instruction, element_context: context, target_url: `${DEMO_URL}/` }),
      });
      setInstruction('');
      await onCreated(`Draft created${data.draft ? ` (${data.draft.id.slice(0, 8)})` : ''}. Review it in the table, then Deploy.`);
    } catch (e: any) {
      onError(e.message);
    } finally {
      setLoading(false);
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
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder='e.g. "Change the logo text to SuperStore" or "Make the checkout button green"'
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 ring-indigo-300 outline-none"
        />
        <button
          onClick={submit}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate patch'}
        </button>
      </div>
    </div>
  );
}
