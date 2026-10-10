import { useState } from 'react';
import { GitCompare, AlertTriangle, Check, ExternalLink, Sparkles } from 'lucide-react';
import type { Patch, Conflict } from '@patchwork/shared';
import { api, usePolling, DEMO_URL, getUserName } from '../lib/api';
import { ErrorBanner, Notice, useNotice } from '../components/Notice';

interface EnrichedConflict extends Conflict {
  patchA?: Patch;
  patchB?: Patch;
}

interface ConflictsResponse {
  hasConflict: boolean;
  conflictingPatches: [Patch, Patch][];
  conflicts?: EnrichedConflict[];
}

export function Conflicts() {
  const { data, error, loading, refresh } = usePolling(() => api<ConflictsResponse>('/conflicts'), 3000);
  const { notice, show } = useNotice();
  const [busy, setBusy] = useState<string | null>(null);
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [showCustomFor, setShowCustomFor] = useState<Record<string, boolean>>({});

  const pairs = data?.conflictingPatches ?? [];
  const storedConflicts = data?.conflicts ?? [];

  const resolve = async (
    conflictId: string | null,
    patchA: Patch,
    patchB: Patch,
    choice: 'a' | 'b' | 'custom',
    customVal?: string
  ) => {
    const key = conflictId || `${patchA.id}-${patchB.id}`;
    setBusy(key);
    try {
      if (conflictId) {
        await api(`/conflicts/${conflictId}/resolve`, {
          method: 'POST',
          body: JSON.stringify({ choice, value: customVal }),
        });
      } else {
        // Fallback using patches
        if (choice === 'a') {
          await api('/conflicts/resolve', {
            method: 'POST',
            body: JSON.stringify({ keptPatchId: patchA.id, discardedPatchId: patchB.id }),
          });
        } else if (choice === 'b') {
          await api('/conflicts/resolve', {
            method: 'POST',
            body: JSON.stringify({ keptPatchId: patchB.id, discardedPatchId: patchA.id }),
          });
        } else {
          // Custom: update patch A with custom value, then keep A
          await api(`/patches/${patchA.id}`, {
            method: 'PUT',
            body: JSON.stringify({ change: { ...patchA.change, value: customVal } }),
          });
          await api('/conflicts/resolve', {
            method: 'POST',
            body: JSON.stringify({ keptPatchId: patchA.id, discardedPatchId: patchB.id }),
          });
        }
      }
      show(`Conflict resolved using ${choice === 'custom' ? `custom value "${customVal}"` : `Patch ${choice.toUpperCase()}`}.`);
      await refresh();
    } catch (e: any) {
      show(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Conflicts</h1>
        <p className="text-slate-500 text-sm mt-1">
          Concurrent edits targeting the same element and property. Compare the base against each author's patch, then choose a resolution.
        </p>
      </div>

      <Notice notice={notice} />
      <ErrorBanner message={error} />

      {pairs.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-center gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
            <div>
              <strong>{pairs.length} conflict(s) detected.</strong> Choose "Use A", "Use B", or provide a custom value to merge.
            </div>
          </div>

          {pairs.map(([a, b]) => {
            const conflictRecord = storedConflicts.find(
              (c) => (c.patch_a === a.id && c.patch_b === b.id) || (c.patch_a === b.id && c.patch_b === a.id)
            );
            const conflictId = conflictRecord?.id ?? null;
            const conflictKey = conflictId || `${a.id}-${b.id}`;
            const isBusy = busy === conflictKey;
            const baseValue = a.anchors.textContent || '(default element style)';
            const customVal = customInputs[conflictKey] ?? '';
            const isCustomOpen = !!showCustomFor[conflictKey];

            return (
              <div key={conflictKey} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-6 py-3.5 bg-slate-50 border-b flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-indigo-600" />
                    <span className="font-semibold text-sm text-slate-800">
                      Target: <code className="font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{a.anchors.cssSelector || '(text search)'}</code>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                      Property: <strong>{a.change.type}</strong>
                    </span>
                    <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-semibold uppercase text-[10px]">
                      {conflictRecord?.type || 'concurrent'}
                    </span>
                  </div>
                </div>

                {/* Three columns: Base value | Patch A | Patch B */}
                <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 text-sm">
                  {/* Column 1: Base Value */}
                  <div className="p-5 flex flex-col justify-between bg-slate-50/50">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        1. Base Value (Live Main)
                      </div>
                      <div className="text-xs text-slate-400 mb-1">Original before draft patches:</div>
                      <div className="font-mono text-xs text-slate-800 bg-white p-3 rounded border break-words shadow-inner">
                        {baseValue}
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-500">
                      Base version: <strong>v{a.base_version}</strong>
                    </div>
                  </div>

                  {/* Column 2: Patch A */}
                  <div className="p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                          2. Patch A ({getUserName(a.author_id)})
                        </span>
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                          {a.id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mb-1">{a.title || 'Proposed Change:'}</div>
                      <div className="font-bold text-xs text-slate-900 bg-indigo-50/60 border border-indigo-200 p-3 rounded break-words">
                        "{a.change.value}"
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t flex items-center justify-between gap-2">
                      <a
                        href={`${DEMO_URL}/?preview_patch=${a.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
                        title="Preview Patch A in isolation"
                      >
                        Preview A <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        disabled={isBusy}
                        onClick={() => resolve(conflictId, a, b, 'a')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" /> Use A
                      </button>
                    </div>
                  </div>

                  {/* Column 3: Patch B */}
                  <div className="p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                          3. Patch B ({getUserName(b.author_id)})
                        </span>
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                          {b.id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mb-1">{b.title || 'Proposed Change:'}</div>
                      <div className="font-bold text-xs text-slate-900 bg-emerald-50/60 border border-emerald-200 p-3 rounded break-words">
                        "{b.change.value}"
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t flex items-center justify-between gap-2">
                      <a
                        href={`${DEMO_URL}/?preview_patch=${b.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold inline-flex items-center gap-1"
                        title="Preview Patch B in isolation"
                      >
                        Preview B <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        disabled={isBusy}
                        onClick={() => resolve(conflictId, a, b, 'b')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" /> Use B
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom Custom Value Option */}
                <div className="px-6 py-3 bg-slate-50 border-t flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() =>
                      setShowCustomFor((prev) => ({ ...prev, [conflictKey]: !prev[conflictKey] }))
                    }
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    {isCustomOpen ? 'Hide Custom Value' : 'Resolve with Custom Value...'}
                  </button>

                  {isCustomOpen && (
                    <div className="flex-1 flex items-center gap-2 max-w-lg">
                      <input
                        value={customVal}
                        onChange={(e) =>
                          setCustomInputs((prev) => ({ ...prev, [conflictKey]: e.target.value }))
                        }
                        placeholder={`Custom ${a.change.type} value...`}
                        className="flex-1 px-3 py-1.5 border rounded text-xs font-mono focus:ring-2 ring-indigo-300 outline-none"
                      />
                      <button
                        disabled={isBusy || !customVal.trim()}
                        onClick={() => resolve(conflictId, a, b, 'custom', customVal.trim())}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50 whitespace-nowrap shadow-sm"
                      >
                        Apply Custom
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !loading && (
          <div className="bg-white p-12 rounded-xl border text-center text-slate-500 space-y-2">
            <Check className="w-8 h-8 text-emerald-500 mx-auto" />
            <h3 className="text-base font-semibold text-slate-800">No open conflicts</h3>
            <p className="text-sm text-slate-500">Every patch targets a distinct element or property.</p>
          </div>
        )
      )}
    </div>
  );
}
