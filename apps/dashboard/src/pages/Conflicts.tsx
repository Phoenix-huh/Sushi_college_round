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
        <h1 className="text-3xl sm:text-4xl font-headline font-bold tracking-tight text-white">Conflicts</h1>
        <p className="text-on-surface-variant font-mono text-sm sm:text-base mt-1">
          Concurrent edits targeting the same element and property. Compare the base against each author's patch, then choose a resolution.
        </p>
      </div>

      <Notice notice={notice} />
      <ErrorBanner message={error} />

      {pairs.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-amber-950/40 border border-amber-500/50 text-amber-200 p-4 rounded-xl flex items-center gap-3 text-xs sm:text-sm font-mono backdrop-blur-md shadow-lg">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
            <div>
              <strong className="text-white">{pairs.length} conflict(s) detected.</strong> Choose "Use A", "Use B", or provide a custom value to merge.
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
              <div key={conflictKey} className="cyber-glass rounded-xl border border-outline-variant/30 shadow-lg overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-surface-container/60 border-b border-outline-variant/30 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GitCompare className="w-4.5 h-4.5 text-primary-container" />
                    <span className="font-semibold text-sm sm:text-base text-white font-headline">
                      Target: <code className="font-mono text-primary bg-surface-container-highest px-2 py-0.5 rounded border border-outline-variant/30 text-xs sm:text-sm">{a.anchors.cssSelector || '(text search)'}</code>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-mono">
                    <span className="bg-surface-container-highest text-on-surface px-2.5 py-0.5 rounded border border-outline-variant/30">
                      Property: <strong>{a.change.type}</strong>
                    </span>
                    <span className="bg-rose-950/60 text-rose-300 border border-rose-500/50 px-2.5 py-0.5 rounded font-bold uppercase text-xs">
                      {conflictRecord?.type || 'concurrent'}
                    </span>
                  </div>
                </div>

                {/* Three columns: Base value | Patch A | Patch B */}
                <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-outline-variant/20 text-xs sm:text-sm font-mono">
                  {/* Column 1: Base Value */}
                  <div className="p-5 flex flex-col justify-between bg-surface-container/30">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-outline mb-2">
                        1. Base Value (Live Main)
                      </div>
                      <div className="text-outline text-xs mb-1.5">Original before draft patches:</div>
                      <div className="text-on-surface bg-surface-container-lowest p-3.5 rounded-lg border border-outline-variant/30 break-words shadow-inner text-xs sm:text-sm">
                        {baseValue}
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-outline-variant/20 text-xs text-outline">
                      Base version: <strong className="text-white">v{a.base_version}</strong>
                    </div>
                  </div>

                  {/* Column 2: Patch A */}
                  <div className="p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary">
                          2. Patch A ({getUserName(a.author_id)})
                        </span>
                        <span className="text-xs font-mono bg-surface-container-high text-outline px-2 py-0.5 rounded">
                          {a.id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="text-xs text-outline mb-1.5">{a.title || 'Proposed Change:'}</div>
                      <div className="font-bold text-white bg-primary-container/10 border border-primary-container/40 p-3.5 rounded-lg break-words text-sm sm:text-base">
                        "{a.change.value}"
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between gap-2">
                      <a
                        href={`${DEMO_URL}/?preview_patch=${a.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs sm:text-sm text-primary hover:text-white font-semibold inline-flex items-center gap-1 transition-colors"
                        title="Preview Patch A in isolation"
                      >
                        Preview A <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        disabled={isBusy}
                        onClick={() => resolve(conflictId, a, b, 'a')}
                        className="bg-primary-container hover:bg-[#ff1e70] text-white px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Check className="w-4 h-4" /> Use A
                      </button>
                    </div>
                  </div>

                  {/* Column 3: Patch B */}
                  <div className="p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-secondary">
                          3. Patch B ({getUserName(b.author_id)})
                        </span>
                        <span className="text-xs font-mono bg-surface-container-high text-outline px-2 py-0.5 rounded">
                          {b.id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="text-xs text-outline mb-1.5">{b.title || 'Proposed Change:'}</div>
                      <div className="font-bold text-white bg-secondary-container/20 border border-secondary-container/50 p-3.5 rounded-lg break-words text-sm sm:text-base">
                        "{b.change.value}"
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between gap-2">
                      <a
                        href={`${DEMO_URL}/?preview_patch=${b.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs sm:text-sm text-secondary hover:text-white font-semibold inline-flex items-center gap-1 transition-colors"
                        title="Preview Patch B in isolation"
                      >
                        Preview B <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        disabled={isBusy}
                        onClick={() => resolve(conflictId, a, b, 'b')}
                        className="bg-secondary-container hover:bg-[#963467] text-white px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Check className="w-4 h-4" /> Use B
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom Custom Value Option */}
                <div className="px-6 py-3.5 bg-surface-container/50 border-t border-outline-variant/30 flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() =>
                      setShowCustomFor((prev) => ({ ...prev, [conflictKey]: !prev[conflictKey] }))
                    }
                    className="text-xs sm:text-sm font-mono font-semibold text-primary hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-primary-container" />
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
                        className="flex-1 px-3.5 py-1.5 bg-surface-container border border-outline-variant/50 rounded-lg text-xs sm:text-sm font-mono text-white focus:border-primary-container outline-none"
                      />
                      <button
                        disabled={isBusy || !customVal.trim()}
                        onClick={() => resolve(conflictId, a, b, 'custom', customVal.trim())}
                        className="bg-primary-container hover:bg-[#ff1e70] text-white px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-mono font-semibold disabled:opacity-50 whitespace-nowrap shadow-sm transition-all cursor-pointer"
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
          <div className="cyber-glass p-12 rounded-xl border border-outline-variant/30 text-center font-mono space-y-2 shadow-lg">
            <Check className="w-8 h-8 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-headline font-bold text-white">No open conflicts</h3>
            <p className="text-xs sm:text-sm text-outline">Every patch targets a distinct element or property.</p>
          </div>
        )
      )}
    </div>
  );
}
