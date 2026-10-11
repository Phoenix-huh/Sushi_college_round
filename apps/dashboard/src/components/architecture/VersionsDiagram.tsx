import React, { useState, useCallback } from 'react';
import type { AuditEvent } from '@patchwork/shared';
import { api, usePolling } from '../../lib/api';
import { getRouteString } from '../../lib/lifecycle';
import type { NodeDetail } from './NodeDetailPanel';
import { RotateCcw, ArrowRight, Play } from 'lucide-react';

interface VersionsDiagramProps {
  activeNodeId: string | null;
  onSelectNode: (node: NodeDetail) => void;
}

interface RailVersion {
  id: string;
  versionNum: number;
  label: string;
  patches: string[];
  isRolledBack?: boolean;
  createdAt: string;
  description: string;
}

const INITIAL_VERSIONS: RailVersion[] = [
  {
    id: 'ver-1',
    versionNum: 1,
    label: 'v1: Baseline App',
    patches: [],
    createdAt: '14:00:00',
    description: 'Initial production build without hotfixes.',
  },
  {
    id: 'ver-2',
    versionNum: 2,
    label: 'v2: Checkout Button Text',
    patches: ['patch-1 (#checkout-btn text)'],
    createdAt: '14:20:15',
    description: 'First hotfix applied: updated button copy to "Pay & Complete Order".',
  },
  {
    id: 'ver-3',
    versionNum: 3,
    label: 'v3: Checkout Style Hotfix',
    patches: ['patch-1 (#checkout-btn text)', 'patch-4 (#checkout-btn style)'],
    createdAt: '14:45:30',
    description: 'Second hotfix merged: background color styling on checkout CTA.',
  },
];

const SAMPLE_AUDIT_FALLBACK: AuditEvent[] = [
  {
    id: '7b8f2c11-92e1-4561-8ca0-128f9d01e47a',
    event_type: 'patch_created',
    actor_id: '11111111-1111-1111-1111-111111111111',
    entity_id: '4a1e9b20-6d3f-42a1-b844-09c3e1b7f001',
    created_at: '2026-10-10T14:32:00.000Z',
    details: { title: 'Checkout CTA copy', selector: '#checkout-btn', change_type: 'text' },
  },
  {
    id: 'c41a0833-241b-4f90-a312-d891b6e40992',
    event_type: 'patch_submitted',
    actor_id: '11111111-1111-1111-1111-111111111111',
    entity_id: '4a1e9b20-6d3f-42a1-b844-09c3e1b7f001',
    created_at: '2026-10-10T14:35:10.000Z',
    details: { base_version: 1, rebased: true },
  },
  {
    id: 'f820c744-1234-45aa-bbcc-998877665544',
    event_type: 'patch_approved',
    actor_id: '22222222-2222-2222-2222-222222222222',
    entity_id: '4a1e9b20-6d3f-42a1-b844-09c3e1b7f001',
    created_at: '2026-10-10T14:38:00.000Z',
    details: { reviewer_comment: 'LGTM; text changes verified' },
  },
  {
    id: '88776655-4433-2211-00aa-bbccddeeff00',
    event_type: 'version_created',
    actor_id: '11111111-1111-1111-1111-111111111111',
    entity_id: 'e1029384-a1b2-4c3d-8e9f-0123456789ab',
    created_at: '2026-10-10T14:40:00.000Z',
    details: { version_number: 2, parent_id: 'v1', ops_count: 1 },
  },
  {
    id: 'aa11bb22-3344-5566-7788-9900aabbccdd',
    event_type: 'deployment_created',
    actor_id: '11111111-1111-1111-1111-111111111111',
    entity_id: 'd9876543-210f-eedd-ccbb-aa9988776655',
    created_at: '2026-10-10T14:40:02.000Z',
    details: { version_id: 'v2', canary_pct: 100 },
  },
];

export function VersionsDiagram({ activeNodeId, onSelectNode }: VersionsDiagramProps) {
  const [versions, setVersions] = useState<RailVersion[]>(INITIAL_VERSIONS);
  const [currentLiveId, setCurrentLiveId] = useState<string>('ver-3');
  const [simulationLog, setSimulationLog] = useState<string | null>(null);

  // Real audit polling
  const fetchAudit = useCallback(() => api<AuditEvent[]>('/audit'), []);
  const { data: auditLogs, error: auditError, loading: auditLoading } = usePolling<AuditEvent[]>(fetchAudit, 3000);

  const displayEvents: AuditEvent[] =
    auditLogs && Array.isArray(auditLogs) && auditLogs.length > 0
      ? auditLogs
      : auditError || !auditLogs
      ? SAMPLE_AUDIT_FALLBACK
      : [];

  // Simulate POST /patches/:id/undeploy
  const handleUndeploy = () => {
    const nextVerNum = versions.length + 1;
    const newVerId = `ver-${nextVerNum}`;
    const newVersion: RailVersion = {
      id: newVerId,
      versionNum: nextVerNum,
      label: `v${nextVerNum}: Undeploy Patch #4`,
      patches: ['patch-1 (#checkout-btn text)'],
      createdAt: 'Just now',
      description:
        `Created by POST /patches/:id/undeploy. Synthesized a new version bundle (v${nextVerNum}) retaining all active patches except patch #4.`,
    };

    setVersions((prev) => [...prev, newVersion]);
    setCurrentLiveId(newVerId);
    setSimulationLog(
      `POST /patches/:id/undeploy executed: Created new version bundle v${nextVerNum} (omitting patch #4). LIVE deployment advanced to v${nextVerNum}.`
    );

    onSelectNode({
      id: newVerId,
      title: `Version v${nextVerNum} (New Deployment)`,
      subtitle: 'Created via POST /patches/:id/undeploy',
      category: 'Undeploy Execution',
      badge: 'Live Manifest',
      color: 'success',
      route: getRouteString('POST', '/patches/:id/undeploy'),
      description:
        `Undeploying does not destroy history. The server creates an incremented Version bundle (v${nextVerNum}) with the remaining patches and deploys it live.`,
      bullets: [
        'Creates new immutable Version record with parent link',
        'Updates site.live_version_id and live deployment manifest',
        'Target page runtime picks up change on next poll (2s)',
      ],
      code: `POST /patches/patch-4/undeploy\n=> Generated Version v${nextVerNum} with ops: [patch-1]`,
    });
  };

  // Simulate POST /rollback
  const handleRollback = () => {
    const curIdx = versions.findIndex((v) => v.id === currentLiveId);
    if (curIdx <= 0) return;

    let targetIdx = -1;
    for (let i = curIdx - 1; i >= 0; i--) {
      if (!versions[i].isRolledBack) {
        targetIdx = i;
        break;
      }
    }
    if (targetIdx === -1) targetIdx = 0;

    const rolledBackVersion = versions[curIdx];
    const targetVersion = versions[targetIdx];

    setVersions((prev) =>
      prev.map((v) => (v.id === rolledBackVersion.id ? { ...v, isRolledBack: true } : v))
    );
    setCurrentLiveId(targetVersion.id);
    setSimulationLog(
      `POST /rollback executed: Marked deployment ${rolledBackVersion.label} rolled back. LIVE pointer restored to ${targetVersion.label}.`
    );

    onSelectNode({
      id: rolledBackVersion.id,
      title: `Rollback: Restored ${targetVersion.label}`,
      subtitle: 'Executed via POST /rollback',
      category: 'Rollback Execution',
      badge: 'Deployment Rollback',
      color: 'failure',
      route: getRouteString('POST', '/rollback'),
      description:
        `POST /rollback does not create a new version bundle. It reactivates the most recent earlier non-rolled-back deployment and records a deployment_rolled_back audit event.`,
      bullets: [
        `Deployment for ${rolledBackVersion.label} marked rolled_back_at: timestamp`,
        `site.live_version_id updated to target version ${targetVersion.versionNum}`,
        `Audit trail event written: deployment_rolled_back`,
      ],
      code: `POST /rollback\n=> Rolled back deployment for ${rolledBackVersion.id}\n=> Active live version is now v${targetVersion.versionNum}`,
    });
  };

  const handleReset = () => {
    setVersions(INITIAL_VERSIONS);
    setCurrentLiveId('ver-3');
    setSimulationLog(null);
  };

  const handleSelectVersion = (v: RailVersion) => {
    const isLive = v.id === currentLiveId;
    onSelectNode({
      id: v.id,
      title: `Version v${v.versionNum}`,
      subtitle: v.label,
      category: isLive ? 'Active Live Version' : v.isRolledBack ? 'Rolled Back Deployment' : 'Historical Bundle',
      badge: isLive ? 'LIVE' : v.isRolledBack ? 'ROLLED BACK' : 'DEPLOYED',
      color: isLive ? 'primary' : v.isRolledBack ? 'failure' : 'neutral',
      route: getRouteString('GET', '/versions'),
      description: v.description,
      bullets: [
        `Ops snapshot patches: ${v.patches.length > 0 ? v.patches.join(', ') : 'None (clean baseline)'}`,
        `Created timestamp: ${v.createdAt}`,
        isLive ? 'Currently polled by page runtime via GET /deployments/live' : 'Historical immutable bundle in store',
      ],
      meta: {
        Version: `v${v.versionNum}`,
        Patches: v.patches.length,
        Live: isLive ? 'True' : 'False',
      },
    });
  };

  const handleSelectAudit = (evt: AuditEvent) => {
    onSelectNode({
      id: evt.id,
      title: `Audit: ${evt.event_type}`,
      subtitle: `Recorded at ${new Date(evt.created_at).toLocaleTimeString()}`,
      category: 'Audit Trail Event',
      badge: evt.event_type,
      color: evt.event_type.includes('rollback') ? 'failure' : 'primary',
      route: getRouteString('GET', '/audit'),
      description: `Immutable audit log record storing actor ID, event type, entity ID, and JSON details.`,
      bullets: [
        `Actor ID: ${evt.actor_id}`,
        `Entity ID: ${evt.entity_id}`,
        `Timestamp: ${evt.created_at}`,
      ],
      code: JSON.stringify(evt.details || {}, null, 2),
      meta: {
        EventType: evt.event_type,
        Actor: evt.actor_id.slice(0, 8),
      },
    });
  };

  return (
    <div className="space-y-6 w-full">
      {/* Simulation Controls & Status Banner */}
      <div className="p-5 rounded-3xl cyber-glass border border-outline-variant/40 flex flex-wrap items-center justify-between gap-4 shadow-lg w-full">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-mono text-outline font-semibold uppercase">Simulate Actions:</span>
          <button
            onClick={handleUndeploy}
            className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-white font-mono text-xs font-bold transition-all flex items-center gap-2"
            title="Create a new version without a specific patch"
          >
            <Play className="w-3.5 h-3.5 text-primary" />
            <span>Undeploy a patch</span>
          </button>
          <button
            onClick={handleRollback}
            className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-rose-500/30 text-rose-300 font-mono text-xs font-bold transition-all flex items-center gap-2"
            title="Reactivate previous non-rolled-back deployment"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span>Roll back</span>
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/20 text-outline hover:text-white font-mono text-xs transition-colors"
            title="Reset simulation"
          >
            Reset
          </button>
        </div>

        {simulationLog && (
          <p className="text-xs font-mono text-primary-fixed-dim bg-primary-container/10 px-3.5 py-1.5 rounded-xl border border-primary-container/30">
            {simulationLog}
          </p>
        )}
      </div>

      {/* Version Rail Interactive SVG: Wide & Clean */}
      <div className="p-5 sm:p-8 rounded-3xl cyber-glass border border-outline-variant/40 shadow-2xl overflow-hidden relative font-mono w-full">
        <span className="text-xs uppercase font-bold text-white block mb-4">
          Immutable Version Rail & Active Deployment Pointer
        </span>

        <svg
          viewBox="0 0 1160 170"
          className="w-full h-auto select-none"
          role="img"
          aria-labelledby="rail-title rail-desc"
        >
          <title id="rail-title">Version Rail and Deployment Pointer</title>
          <desc id="rail-desc">
            Horizontal track of version nodes with LIVE indicator pointing to the active deployment.
          </desc>

          {/* Background Rail Track Line */}
          <line x1="80" y1="85" x2="1080" y2="85" stroke="#353439" strokeWidth="5" strokeLinecap="round" />

          {/* Render Version Nodes */}
          {versions.map((ver, idx) => {
            const total = versions.length;
            const x = 120 + (idx / Math.max(1, total - 1)) * 920;
            const isLive = ver.id === currentLiveId;
            const isRolledBack = ver.isRolledBack;
            const isSelected = activeNodeId === ver.id;

            return (
              <g
                key={ver.id}
                role="button"
                tabIndex={0}
                aria-label={`${ver.label} ${isLive ? 'LIVE' : ''} ${isRolledBack ? 'ROLLED BACK' : ''}`}
                onClick={() => handleSelectVersion(ver)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelectVersion(ver)}
                className="cursor-pointer transition-transform focus:outline-none"
              >
                {/* Connecting tick */}
                <line x1={x} y1="75" x2={x} y2="95" stroke={isLive ? '#ff3b81' : '#aa888e'} strokeWidth="2.5" />

                {/* Circle Dot */}
                <circle
                  cx={x}
                  cy="85"
                  r={isLive ? '16' : '11'}
                  fill={isRolledBack ? '#381017' : isLive ? '#ff3b81' : '#1b1b20'}
                  stroke={isRolledBack ? '#f43f5e' : isLive ? '#ffb1c2' : isSelected ? '#ff3b81' : '#5a4045'}
                  strokeWidth={isLive || isSelected ? '3.5' : '1.8'}
                />

                {/* Label text */}
                <text
                  x={x}
                  y="122"
                  fill={isRolledBack ? '#fca5a5' : '#ffffff'}
                  fontSize="13"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="Syne, sans-serif"
                >
                  v{ver.versionNum}
                </text>
                <text
                  x={x}
                  y="142"
                  fill="#aa888e"
                  fontSize="12"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {isRolledBack ? 'Rolled Back' : ver.createdAt}
                </text>

                {/* LIVE Pointer Pill on Top */}
                {isLive && (
                  <g transform={`translate(${x}, 32)`}>
                    <rect
                      x="-36"
                      y="-18"
                      width="72"
                      height="26"
                      rx="13"
                      fill="#ff3b81"
                      stroke="#ffffff"
                      strokeWidth="1.8"
                    />
                    <text
                      x="0"
                      y="-1"
                      fill="#ffffff"
                      fontSize="12"
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      LIVE
                    </text>
                    <polygon points="-6,8 6,8 0,16" fill="#ff3b81" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20 text-xs text-outline">
          <span>Click any version dot to inspect its ops snapshot and deployment metadata</span>
          <span>GET /versions</span>
        </div>
      </div>

      {/* Live Audit Event Timeline: Zero Scrollbar */}
      <div className="p-6 rounded-3xl cyber-glass border border-outline-variant/40 space-y-4 font-mono shadow-xl w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-full bg-primary-container animate-pulse" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Audit Event Log (GET /audit)
            </h4>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {auditLoading && <span className="text-outline">Syncing...</span>}
            {auditError && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Sample fallback data
              </span>
            )}
            <span className="text-outline">{displayEvents.length} events logged</span>
          </div>
        </div>

        {/* Audit Timeline Rows */}
        <div className="divide-y divide-outline-variant/20 text-xs">
          {displayEvents.map((evt) => {
            const isRollback = evt.event_type.includes('rollback');
            const isApproved = evt.event_type.includes('approved');
            const isDeploy = evt.event_type.includes('version') || evt.event_type.includes('deployment');

            return (
              <button
                key={evt.id}
                onClick={() => handleSelectAudit(evt)}
                className="w-full py-3 px-3.5 flex items-center justify-between gap-4 hover:bg-surface-container/60 rounded-xl text-left transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`size-2 rounded-full shrink-0 ${
                      isRollback ? 'bg-rose-400' : isApproved ? 'bg-emerald-400' : isDeploy ? 'bg-primary' : 'bg-outline'
                    }`}
                  />
                  <span className="font-bold text-white text-xs">{evt.event_type}</span>
                  <span className="text-xs text-outline font-mono hidden sm:inline">
                    entity: {evt.entity_id.slice(0, 8)}...
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-outline">
                  <span>{new Date(evt.created_at).toLocaleTimeString()}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-outline-variant" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
