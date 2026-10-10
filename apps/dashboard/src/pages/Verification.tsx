import { useState } from 'react';
import { ShieldCheck, ShieldAlert, Play, CheckCircle2, XCircle } from 'lucide-react';
import type { Version, AuditEvent } from '@patchwork/shared';
import { api, usePolling } from '../lib/api';
import { ErrorBanner, Notice, useNotice } from '../components/Notice';

interface VerifyResult {
  version_id: string;
  passed: boolean;
  diffPixels: number;
  error?: string;
}

export function Verification() {
  const versionsQ = usePolling(() => api<Version[]>('/versions'));
  const auditQ = usePolling(() => api<AuditEvent[]>('/audit'), 4000);
  const { notice, show } = useNotice();
  const [selected, setSelected] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<VerifyResult | null>(null);

  const versions = versionsQ.data ?? [];
  const versionId = selected || versions[0]?.id || '';
  const numberOf = (id: string) => versions.find((v) => v.id === id)?.number;
  const history = (auditQ.data ?? []).filter(
    (e) => e.event_type === 'verification_passed' || e.event_type === 'verification_failed',
  );

  const run = async () => {
    if (!versionId) return;
    setRunning(true);
    setLast(null);
    try {
      const result = await api<VerifyResult>('/verify', { method: 'POST', body: JSON.stringify({ version_id: versionId }) });
      setLast(result);
      show(result.passed
        ? 'Verification passed.'
        : 'Verification failed. If this version was live it has been rolled back.', result.passed ? 'success' : 'error');
      await Promise.all([versionsQ.refresh(), auditQ.refresh()]);
    } catch (e: any) {
      show(e.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verification Center</h1>
          <p className="text-slate-500 text-sm mt-1">
            Runs the checkout flow in a real browser with the version's patches applied, compares screenshots, and rolls back a live version that fails.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={versionId}
            onChange={(e) => setSelected(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                Version {v.number} ({v.patch_ids.length} patch{v.patch_ids.length === 1 ? '' : 'es'}, {v.verification_status})
              </option>
            ))}
          </select>
          <button
            onClick={run}
            disabled={running || !versionId}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <Play className="w-4 h-4" /> {running ? 'Running...' : 'Run verification'}
          </button>
        </div>
      </div>

      <Notice notice={notice} />
      <ErrorBanner message={versionsQ.error} />

      {last && (
        <div className={`rounded-lg border p-5 flex items-start gap-3 ${last.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          {last.passed ? <ShieldCheck className="w-6 h-6 text-emerald-600" /> : <ShieldAlert className="w-6 h-6 text-red-600" />}
          <div className="text-sm">
            <div className="font-semibold">{last.passed ? 'Passed' : 'Failed'}: Version {numberOf(last.version_id)}</div>
            {last.passed && <div className="text-slate-600">{last.diffPixels} pixels differ from the unpatched page.</div>}
            {last.error && (
              <div className="text-red-700 font-mono text-xs mt-1 break-words">
                {last.error}
                {/Executable doesn't exist|playwright install/i.test(last.error) && (
                  <div className="mt-1 font-sans">Browser missing: run <code>npx playwright install chromium</code> once on the server machine.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-6 py-3 border-b text-sm font-semibold text-slate-700">Verification history</div>
        <ul className="divide-y">
          {history.map((e) => {
            const passed = e.event_type === 'verification_passed';
            const d = e.details as { diffPixels?: number; error?: string };
            return (
              <li key={e.id} className="px-6 py-3 flex items-start gap-3 text-sm">
                {passed ? <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-600 mt-0.5" />}
                <div className="flex-1">
                  <div className="font-medium">
                    Version {numberOf(e.entity_id) ?? e.entity_id.slice(0, 8)}: {passed ? 'passed' : 'failed'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(e.created_at).toLocaleString()}
                    {passed && typeof d.diffPixels === 'number' ? ` · ${d.diffPixels} px diff` : ''}
                    {d.error ? ` · ${d.error}` : ''}
                  </div>
                </div>
              </li>
            );
          })}
          {history.length === 0 && <li className="px-6 py-6 text-slate-500 text-sm">No verification runs yet.</li>}
        </ul>
      </div>
    </div>
  );
}
