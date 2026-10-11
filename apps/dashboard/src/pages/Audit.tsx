import type { AuditEvent } from '@patchwork/shared';
import { api, usePolling, getUserName } from '../lib/api';
import { ErrorBanner } from '../components/Notice';
import {
  FileText,
  GitMerge,
  Send,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Globe,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

export function Audit() {
  const { data, error, loading } = usePolling(() => api<AuditEvent[]>('/audit'), 3000);
  const events = data ?? [];

  const getEventMeta = (type: string) => {
    switch (type) {
      case 'patch_merged':
        return { color: 'bg-emerald-500', icon: GitMerge, badge: 'bg-emerald-100 text-emerald-800' };
      case 'patch_approved':
        return { color: 'bg-purple-500', icon: CheckCircle, badge: 'bg-purple-100 text-purple-800' };
      case 'patch_submitted':
        return { color: 'bg-blue-500', icon: Send, badge: 'bg-blue-100 text-blue-800' };
      case 'patch_rebased':
        return { color: 'bg-cyan-500', icon: RotateCcw, badge: 'bg-cyan-100 text-cyan-800' };
      case 'conflict_detected':
        return { color: 'bg-rose-500', icon: AlertTriangle, badge: 'bg-rose-100 text-rose-800' };
      case 'conflict_resolved':
        return { color: 'bg-amber-500', icon: Sparkles, badge: 'bg-amber-100 text-amber-800' };
      case 'patch_healed':
        return { color: 'bg-sky-500', icon: Sparkles, badge: 'bg-sky-100 text-sky-800' };
      case 'deployment_rolled_back':
        return { color: 'bg-amber-500', icon: RotateCcw, badge: 'bg-amber-100 text-amber-800' };
      case 'site_created':
        return { color: 'bg-indigo-500', icon: Globe, badge: 'bg-indigo-100 text-indigo-800' };
      case 'verification_passed':
        return { color: 'bg-emerald-500', icon: ShieldCheck, badge: 'bg-emerald-100 text-emerald-800' };
      case 'verification_failed':
        return { color: 'bg-rose-500', icon: ShieldAlert, badge: 'bg-rose-100 text-rose-800' };
      default:
        return { color: 'bg-slate-400', icon: FileText, badge: 'bg-slate-100 text-slate-700' };
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-headline font-bold tracking-tight text-white">Audit Trail</h1>
        <p className="text-sm sm:text-base font-mono text-on-surface-variant mt-1">
          Complete, append-only history of patch creation, submissions, reviews, merges, conflicts, and deployments.
        </p>
      </div>

      <ErrorBanner message={error} />

      <div className="cyber-glass p-6 sm:p-8 rounded-xl border border-outline-variant/30 shadow-lg">
        <ol className="relative border-l border-outline-variant/30 ml-4 space-y-7">
          {events.map((evt) => {
            const meta = getEventMeta(evt.event_type);
            const Icon = meta.icon;
            const actorName = getUserName(evt.actor_id);

            return (
              <li key={evt.id} className="ml-6">
                <span
                  className={`absolute flex items-center justify-center w-6.5 h-6.5 rounded-full -left-3.5 ring-4 ring-surface-container-lowest text-white ${meta.color}`}
                >
                  <Icon className="w-4 h-4" />
                </span>

                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-wider bg-surface-container border border-outline-variant/40 text-primary">
                      {evt.event_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs sm:text-sm font-mono text-on-surface font-semibold">by {actorName}</span>
                  </div>
                  <time className="text-xs sm:text-sm text-outline font-mono">
                    {new Date(evt.created_at).toLocaleString()}
                  </time>
                </div>

                <div className="text-xs sm:text-sm text-outline font-mono mb-2">
                  Entity ID: <span className="text-on-surface font-medium">{evt.entity_id}</span>
                </div>

                <div className="text-xs sm:text-sm text-on-surface bg-surface-container-lowest/80 p-3.5 rounded-lg border border-outline-variant/30 font-mono break-words shadow-inner leading-relaxed">
                  {JSON.stringify(evt.details, null, 2)}
                </div>
              </li>
            );
          })}
          {!loading && events.length === 0 && (
            <li className="ml-6 text-outline text-sm font-mono">No audit events recorded yet.</li>
          )}
        </ol>
      </div>
    </div>
  );
}
