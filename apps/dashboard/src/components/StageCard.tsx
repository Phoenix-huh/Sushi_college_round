import React from 'react';
import type { LifecycleStage } from '../lib/lifecycle';

interface StageCardProps {
  stage: LifecycleStage;
  showRoute?: boolean;
}

export function StageCard({ stage, showRoute = false }: StageCardProps) {
  return (
    <div className="p-4 rounded-xl bg-surface-container/70 border border-outline-variant/30 space-y-2.5 font-mono text-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-bold text-primary text-sm">
            0{stage.step}. {stage.name}
          </span>
          <span className="text-xs text-outline px-2 py-0.5 rounded bg-surface-container-lowest border border-outline-variant/20 font-semibold">
            {stage.resultingStatus}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">{stage.summary}</p>
      </div>
      {showRoute && (
        <div className="pt-2 border-t border-outline-variant/20 text-xs text-outline truncate" title={stage.route}>
          <code>{stage.route}</code>
        </div>
      )}
    </div>
  );
}
