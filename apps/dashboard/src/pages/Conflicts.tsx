import { useState } from 'react';
import { GitCompare, AlertTriangle, Check, User } from 'lucide-react';
import type { Patch } from '@patchwork/shared';
import { api, usePolling } from '../lib/api';
import { ErrorBanner, Notice, useNotice } from '../components/Notice';

interface ConflictsResponse {
  hasConflict: boolean;
  conflictingPatches: [Patch, Patch][];
}

export function Conflicts() {
  const { data, error, loading, refresh } = usePolling(() => api<ConflictsResponse>('/conflicts'));
  const { notice, show } = useNotice();
  const [busy, setBusy] = useState<string | null>(null);
  const pairs = data?.conflictingPatches ?? [];

  const resolve = async (kept: Patch, discarded: Patch, deployKept: boolean) => {
    setBusy(kept.id);
    try {
      await api('/conflicts/resolve', {
        method: 'POST',
        body: JSON.stringify({ keptPatchId: kept.id, discardedPatchId: discarded.id }),
      });
      if (deployKept) await api(`/patches/${kept.id}/deploy`, { method: 'POST' });
      show(deployKept ? 'Resolved and deployed. The demo site updates shortly.' : 'Conflict resolved.');
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
          Patches that change the same property of the same element. Keep one; the other is discarded.
        </p>
      </div>

      <Notice notice={notice} />
      <ErrorBanner message={error} />

      {pairs.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-center gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
            <div><strong>{pairs.length} conflict(s) detected.</strong> Compare the two sides and choose which to keep.</div>
          </div>

          {pairs.map(([a, b]) => (
            <div key={`${a.id}-${b.id}`} className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="px-6 py-3 bg-slate-50 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold text-sm text-slate-800">
                    Conflict on <code className="font-mono text-indigo-600">{a.anchors.cssSelector}</code>
                  </span>
                </div>
                <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">Property: {a.change.type}</span>
              </div>

              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                {[[a, b], [b, a]].map(([mine, other]) => (
                  <div key={mine.id} className="p-6 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">{mine.status.toUpperCase()}</span>
                        <span className="text-xs text-slate-400 font-mono">ID: {mine.id.slice(0, 8)}</span>
                      </div>
                      <span className="text-xs text-slate-400 block mt-3">Value:</span>
                      <div className="text-base font-bold text-slate-900 bg-slate-50 p-2.5 rounded border mt-1 break-words">"{mine.change.value}"</div>
                      <div className="text-xs text-slate-500 pt-3 flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Author {mine.author_id.slice(0, 8)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={busy === mine.id}
                        onClick={() => resolve(mine, other, false)}
                        className="flex-1 flex items-center justify-center gap-2 border bg-white hover:bg-slate-50 py-2 rounded text-sm font-medium disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" /> Keep this
                      </button>
                      <button
                        disabled={busy === mine.id}
                        onClick={() => resolve(mine, other, true)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded text-sm font-medium disabled:opacity-50"
                      >
                        Keep and deploy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading && (
          <div className="bg-white p-8 rounded-lg border text-center text-slate-500">
            No conflicts. Every patch targets a different element or property.
          </div>
        )
      )}
    </div>
  );
}
