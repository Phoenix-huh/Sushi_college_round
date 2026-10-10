import { useState } from 'react';
import type { Deployment, Version, Patch } from '@patchwork/shared';
import { api, usePolling } from '../lib/api';
import { ErrorBanner, Notice, useNotice } from '../components/Notice';

type DeploymentRow = Deployment & { versions: Version | null };

export function Deployments() {
  const depsQ = usePolling(() => api<DeploymentRow[]>('/deployments'));
  const patchesQ = usePolling(() => api<Patch[]>('/patches'), 5000);
  const { notice, show } = useNotice();
  const [busy, setBusy] = useState<string | null>(null);

  const deployments = depsQ.data ?? [];
  const patchById = new Map((patchesQ.data ?? []).map((p) => [p.id, p]));
  const hasLive = deployments.some((d) => d.is_live);

  const act = async (key: string, okMessage: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      show(okMessage);
      await Promise.all([depsQ.refresh(), patchesQ.refresh()]);
    } catch (e: any) {
      show(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const rollback = () => {
    if (!window.confirm('Roll back the live deployment? The previous version goes live.')) return;
    void act('rollback', 'Rolled back. The demo site reverts within a couple of seconds.', () =>
      api('/rollback', { method: 'POST' }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight text-white">Deployments</h1>
          <p className="text-sm font-mono text-on-surface-variant mt-1">
            {hasLive ? 'A version is live on the demo site.' : 'Nothing is live: the demo site shows its original content.'}
          </p>
        </div>
        <button
          onClick={rollback}
          disabled={!hasLive || busy === 'rollback'}
          className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all disabled:opacity-40 shadow-sm"
        >
          Rollback live
        </button>
      </div>

      <Notice notice={notice} />
      <ErrorBanner message={depsQ.error} />

      <div className="grid gap-4">
        {deployments.map((dep) => {
          const ids = dep.versions?.patch_ids ?? [];
          return (
            <div key={dep.id} className="cyber-glass p-6 rounded-xl border border-outline-variant/30 shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-headline font-bold text-lg text-white">Version {dep.versions?.number ?? '?'}</h3>
                    {dep.is_live && <span className="bg-emerald-950/60 text-emerald-300 border border-emerald-500/50 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">LIVE</span>}
                    {dep.rolled_back_at && <span className="bg-rose-950/60 text-rose-300 border border-rose-500/50 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">ROLLED BACK</span>}
                    {dep.canary_percent < 100 && <span className="bg-sky-950/60 text-sky-300 border border-sky-500/50 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">CANARY {dep.canary_percent}%</span>}
                  </div>
                  <p className="text-xs font-mono text-outline">Deployed {new Date(dep.deployed_at).toLocaleString()}</p>
                  <ul className="mt-3 space-y-1 text-xs text-on-surface-variant">
                    {ids.map((id) => {
                      const p = patchById.get(id);
                      return (
                        <li key={id} className="font-mono text-xs">
                          {p ? (
                            <span>
                              <code className="text-primary">{p.anchors.cssSelector}</code>{' '}
                              <span className="text-outline">[{p.change.type}]</span>{' '}
                              <span className="text-on-surface">{p.change.value.slice(0, 50)}</span>
                            </span>
                          ) : (
                            <span className="text-outline">{id.slice(0, 8)} (deleted)</span>
                          )}
                        </li>
                      );
                    })}
                    {ids.length === 0 && <li className="text-xs font-mono text-outline">No patches in this version</li>}
                  </ul>
                </div>
                <div className="text-right space-y-3">
                  <div className={`text-xs font-mono font-semibold ${
                    dep.versions?.verification_status === 'passed' ? 'text-emerald-400'
                    : dep.versions?.verification_status === 'failed' ? 'text-rose-400'
                    : 'text-amber-400'}`}>
                    Verification: {(dep.versions?.verification_status ?? 'pending').toUpperCase()}
                  </div>
                  {!dep.is_live && (
                    <button
                      disabled={busy === dep.id}
                      onClick={() => act(dep.id, `Version ${dep.versions?.number} is live again.`, () =>
                        api(`/deployments/${dep.id}/activate`, { method: 'POST' }))}
                      className="border border-outline-variant/50 bg-surface-container hover:bg-surface-container-high text-white px-3 py-1.5 rounded-lg text-xs font-mono font-semibold disabled:opacity-50 transition-colors"
                    >
                      Redeploy this version
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!depsQ.loading && deployments.length === 0 && (
          <div className="cyber-glass p-8 rounded-xl border border-outline-variant/30 text-center font-mono text-xs text-outline">No deployments yet</div>
        )}
      </div>
    </div>
  );
}
