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
          <h1 className="text-3xl font-bold tracking-tight">Deployments</h1>
          <p className="text-sm text-slate-500 mt-1">
            {hasLive ? 'A version is live on the demo site.' : 'Nothing is live: the demo site shows its original content.'}
          </p>
        </div>
        <button
          onClick={rollback}
          disabled={!hasLive || busy === 'rollback'}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-40"
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
            <div key={dep.id} className="bg-white p-6 rounded-lg border shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-lg">Version {dep.versions?.number ?? '?'}</h3>
                    {dep.is_live && <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium">LIVE</span>}
                    {dep.rolled_back_at && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">ROLLED BACK</span>}
                    {dep.canary_percent < 100 && <span className="bg-sky-100 text-sky-700 text-xs px-2 py-0.5 rounded-full font-medium">CANARY {dep.canary_percent}%</span>}
                  </div>
                  <p className="text-sm text-slate-500">Deployed {new Date(dep.deployed_at).toLocaleString()}</p>
                  <ul className="mt-3 space-y-1 text-sm text-slate-600">
                    {ids.map((id) => {
                      const p = patchById.get(id);
                      return (
                        <li key={id} className="font-mono text-xs">
                          {p ? `${p.anchors.cssSelector}  ${p.change.type}: ${p.change.value.slice(0, 50)}` : `${id.slice(0, 8)} (deleted)`}
                        </li>
                      );
                    })}
                    {ids.length === 0 && <li className="text-xs text-slate-400">No patches in this version</li>}
                  </ul>
                </div>
                <div className="text-right space-y-3">
                  <div className={`text-sm font-medium ${
                    dep.versions?.verification_status === 'passed' ? 'text-emerald-600'
                    : dep.versions?.verification_status === 'failed' ? 'text-red-600'
                    : 'text-yellow-600'}`}>
                    Verification: {(dep.versions?.verification_status ?? 'pending').toUpperCase()}
                  </div>
                  {!dep.is_live && (
                    <button
                      disabled={busy === dep.id}
                      onClick={() => act(dep.id, `Version ${dep.versions?.number} is live again.`, () =>
                        api(`/deployments/${dep.id}/activate`, { method: 'POST' }))}
                      className="border bg-white hover:bg-slate-50 px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50"
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
          <div className="bg-white p-8 rounded-lg border text-center text-slate-500">No deployments yet</div>
        )}
      </div>
    </div>
  );
}
