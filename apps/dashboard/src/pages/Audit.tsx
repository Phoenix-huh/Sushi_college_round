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
        <h1 className="text-3xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete, append-only history of patch creation, submissions, reviews, merges, conflicts, and deployments.
        </p>
      </div>

      <ErrorBanner message={error} />

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <ol className="relative border-l border-slate-200 ml-4 space-y-6">
          {events.map((evt) => {
            const meta = getEventMeta(evt.event_type);
            const Icon = meta.icon;
            const actorName = getUserName(evt.actor_id);

            return (
              <li key={evt.id} className="ml-6">
                <span
                  className={`absolute flex items-center justify-center w-6 h-6 rounded-full -left-3 ring-4 ring-white text-white ${meta.color}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>

                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${meta.badge}`}>
                      {evt.event_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-600 font-medium">by {actorName}</span>
                  </div>
                  <time className="text-xs text-slate-400 font-mono">
                    {new Date(evt.created_at).toLocaleString()}
                  </time>
                </div>

                <div className="text-xs text-slate-500 font-mono mb-1.5">
                  Entity ID: <span className="text-slate-700">{evt.entity_id}</span>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border font-mono break-words shadow-sm">
                  {JSON.stringify(evt.details, null, 2)}
                </div>
              </li>
            );
          })}
          {!loading && events.length === 0 && (
            <li className="ml-6 text-slate-500 text-sm">No audit events recorded yet.</li>
          )}
        </ol>
      </div>
    </div>
  );
}
