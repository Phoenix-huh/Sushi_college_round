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
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-headline font-bold tracking-tight text-white">Verification Center</h1>
          <p className="text-on-surface-variant font-mono text-sm sm:text-base mt-1">
            Runs the checkout flow in a real browser with the version's patches applied, compares screenshots, and rolls back a live version that fails.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={versionId}
            onChange={(e) => setSelected(e.target.value)}
            className="border border-outline-variant/40 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-mono bg-surface-container text-white focus:border-primary-container outline-none"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id} className="bg-surface-container text-white">
                Version {v.number} ({v.patch_ids.length} patch{v.patch_ids.length === 1 ? '' : 'es'}, {v.verification_status})
              </option>
            ))}
          </select>
          <button
            onClick={run}
            disabled={running || !versionId}
            className="flex items-center gap-2 bg-primary-container hover:bg-[#ff1e70] text-white px-4.5 py-2 rounded-lg text-xs sm:text-sm font-mono font-semibold disabled:opacity-50 transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4" /> {running ? 'Running...' : 'Run verification'}
          </button>
        </div>
      </div>

      <Notice notice={notice} />
      <ErrorBanner message={versionsQ.error} />

      {last && (
        <div className={`rounded-xl border p-5 flex items-start gap-3.5 backdrop-blur-md ${last.passed ? 'bg-emerald-950/40 border-emerald-500/50' : 'bg-rose-950/40 border-rose-500/50'}`}>
          {last.passed ? <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0" /> : <ShieldAlert className="w-7 h-7 text-rose-400 shrink-0" />}
          <div className="text-xs sm:text-sm font-mono">
            <div className="font-bold text-white text-base">{last.passed ? 'Passed' : 'Failed'}: Version {numberOf(last.version_id)}</div>
            {last.passed && <div className="text-emerald-300 mt-1">{last.diffPixels} pixels differ from the unpatched page.</div>}
            {last.error && (
              <div className="text-rose-300 font-mono text-xs sm:text-sm mt-1 break-words">
                {last.error}
                {/Executable doesn't exist|playwright install/i.test(last.error) && (
                  <div className="mt-1 font-sans text-white">Browser missing: run <code>npx playwright install chromium</code> once on the server machine.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="cyber-glass rounded-xl border border-outline-variant/30 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/30 text-sm font-headline font-bold text-white uppercase tracking-wider bg-surface-container/60">
          Verification history
        </div>
        <ul className="divide-y divide-outline-variant/20">
          {history.map((e) => {
            const passed = e.event_type === 'verification_passed';
            const d = e.details as { diffPixels?: number; error?: string };
            return (
              <li key={e.id} className="px-6 py-4 flex items-start gap-3.5 text-xs sm:text-sm font-mono">
                {passed ? <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" /> : <XCircle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />}
                <div className="flex-1">
                  <div className="font-semibold text-white text-sm sm:text-base">
                    Version {numberOf(e.entity_id) ?? e.entity_id.slice(0, 8)}:{' '}
                    <span className={passed ? 'text-emerald-400 uppercase font-bold' : 'text-rose-400 uppercase font-bold'}>
                      {passed ? 'passed' : 'failed'}
                    </span>
                  </div>
                  <div className="text-xs text-outline mt-1">
                    {new Date(e.created_at).toLocaleString()}
                    {passed && typeof d.diffPixels === 'number' ? ` · ${d.diffPixels} px diff` : ''}
                    {d.error ? ` · ${d.error}` : ''}
                  </div>
                </div>
              </li>
            );
          })}
          {history.length === 0 && <li className="px-6 py-6 text-outline text-sm font-mono text-center">No verification runs yet.</li>}
        </ul>
      </div>
    </div>
  );
}
