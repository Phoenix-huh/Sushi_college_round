import { useState, useEffect } from 'react';
import { GitCompare, AlertTriangle, Check, ArrowRight, User } from 'lucide-react';
import type { Patch } from '@patchwork/shared';

interface ConflictPair {
  p1: Patch;
  p2: Patch;
}

export function Conflicts() {
  const [conflicts, setConflicts] = useState<ConflictPair[]>([]);
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    const fetchConflicts = async () => {
      try {
        const res = await fetch('http://localhost:4000/conflicts');
        if (res.ok) {
          const data = await res.json();
          if (data.conflictingPatches?.length) {
            setConflicts(data.conflictingPatches.map(([p1, p2]: [Patch, Patch]) => ({ p1, p2 })));
            return;
          }
        }
      } catch {
        // Fallback demo conflict pair
      }

      // Default demo conflict
      const p1: Patch = {
        id: '11111111-1111-1111-1111-111111111111',
        target_url: 'http://localhost:4100/',
        base_version: 0,
        anchors: {
          cssSelector: '#checkout-btn',
          xpath: '//*[@id="checkout-btn"]',
          textContent: 'Checkout',
          attributes: { id: 'checkout-btn' },
          parentContext: 'div.cart-actions',
          siblingContext: ['div.cart-summary'],
        },
        change: { type: 'text', value: 'Pay & Complete Order' },
        author_id: '00000000-0000-0000-0000-00000001',
        status: 'live',
        created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      };

      const p2: Patch = {
        id: '44444444-4444-4444-4444-444444444444',
        target_url: 'http://localhost:4100/',
        base_version: 0,
        anchors: {
          cssSelector: '#checkout-btn',
          xpath: '//*[@id="checkout-btn"]',
          textContent: 'Checkout',
          attributes: { id: 'checkout-btn' },
          parentContext: 'div.cart-actions',
          siblingContext: ['div.cart-summary'],
        },
        change: { type: 'text', value: 'Express Checkout (Free Shipping)' },
        author_id: '00000000-0000-0000-0000-00000002',
        status: 'draft',
        created_at: new Date(Date.now() - 1800000).toISOString(),
        updated_at: new Date(Date.now() - 1800000).toISOString(),
      };

      setConflicts([{ p1, p2 }]);
    };

    void fetchConflicts();
  }, []);

  const handleResolve = async (pairIndex: number, keptId: string, discardedId: string) => {
    setResolving(keptId);
    try {
      await fetch('http://localhost:4000/conflicts/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keptPatchId: keptId, discardedPatchId: discardedId }),
      });
    } catch {
      // Local state update
    }

    setResolvedIds([...resolvedIds, `${conflicts[pairIndex].p1.id}-${conflicts[pairIndex].p2.id}`]);
    setResolving(null);
  };

  const activeConflicts = conflicts.filter(
    (c) => !resolvedIds.includes(`${c.p1.id}-${c.p2.id}`)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Conflicts</h1>
        <p className="text-slate-500 text-sm mt-1">
          Detect and resolve overlapping patches touching the same DOM selector and property.
        </p>
      </div>

      {activeConflicts.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-center gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
            <div>
              <strong>{activeConflicts.length} Conflict(s) Detected.</strong> Multiple patches target the same element and property. Review the changes side-by-side and choose which version to merge into production.
            </div>
          </div>

          {activeConflicts.map((c, idx) => (
            <div key={idx} className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="px-6 py-3 bg-slate-50 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold text-sm text-slate-800">
                    Conflict on selector: <code className="font-mono text-indigo-600">{c.p1.anchors.cssSelector}</code>
                  </span>
                </div>
                <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                  Property: {c.p1.change.type}
                </span>
              </div>

              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                {/* Left Patch */}
                <div className="p-6 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {c.p1.status.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">ID: {c.p1.id.slice(0, 8)}...</span>
                    </div>

                    <div className="space-y-2 mt-3">
                      <div>
                        <span className="text-xs text-slate-400 block">Proposed Value:</span>
                        <div className="text-base font-bold text-slate-900 bg-slate-50 p-2.5 rounded border mt-1">
                          "{c.p1.change.value}"
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 pt-2 flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Author: dev@patchwork.io</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleResolve(idx, c.p1.id, c.p2.id)}
                    disabled={resolving === c.p1.id}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    Accept Version 1
                  </button>
                </div>

                {/* Right Patch */}
                <div className="p-6 flex flex-col justify-between space-y-4 bg-slate-50/40">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                        {c.p2.status.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">ID: {c.p2.id.slice(0, 8)}...</span>
                    </div>

                    <div className="space-y-2 mt-3">
                      <div>
                        <span className="text-xs text-slate-400 block">Proposed Value:</span>
                        <div className="text-base font-bold text-slate-900 bg-white p-2.5 rounded border mt-1">
                          "{c.p2.change.value}"
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 pt-2 flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Author: reviewer@patchwork.io</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleResolve(idx, c.p2.id, c.p1.id)}
                    disabled={resolving === c.p2.id}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    Accept Version 2
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-lg border shadow-sm text-center text-slate-500">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-1">All Conflicts Resolved</h3>
          <p className="max-w-md mx-auto text-sm">
            No overlapping patches currently detected. As new developer patches are authored, any colliding element selectors and property modifications will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
