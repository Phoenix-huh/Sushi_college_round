import { useEffect, useState } from 'react';
import { hasSupabase, supabase } from '../lib/supabase';
import type { Patch, AuditEvent } from '@patchwork/shared';

type PatchWithHealData = Patch & { healDetails?: Record<string, unknown> };

export function Patches() {
  const [patches, setPatches] = useState<PatchWithHealData[]>([]);
  const [healEvents, setHealEvents] = useState<Record<string, AuditEvent>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      let loadedPatches: Patch[] = [];

      if (hasSupabase && supabase) {
        try {
          const { data: patchData } = await supabase
            .from('patches')
            .select('*')
            .order('created_at', { ascending: false });

          if (patchData && patchData.length > 0) {
            loadedPatches = patchData as Patch[];
          }
        } catch {
          // ignore
        }
      }

      if (loadedPatches.length === 0) {
        try {
          const res = await fetch('http://localhost:4000/patches');
          if (res.ok) {
            const data = await res.json();
            loadedPatches = data as Patch[];
          }
        } catch {
          // ignore
        }
      }

      setPatches(loadedPatches);

      // Fetch heal events
      try {
        const res = await fetch('http://localhost:4000/audit');
        if (res.ok) {
          const evts = await res.json();
          const byEntity: Record<string, AuditEvent> = {};
          for (const e of evts as AuditEvent[]) {
            if (e.event_type === 'patch_healed') {
              byEntity[e.entity_id] = e;
            }
          }
          setHealEvents(byEntity);
        }
      } catch {
        // ignore
      }
    };

    fetchData();

    if (hasSupabase && supabase) {
      try {
        const channel = supabase
          .channel('patches_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'patches' }, fetchData)
          .subscribe();

        return () => {
          if (supabase) supabase.removeChannel(channel);
        };
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Patches</h1>

      {/* Natural language patch prompt */}
      <NLPromptBox onCreated={(newPatch) => setPatches((prev) => [newPatch, ...prev])} />

      <div className="bg-white rounded-lg border shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b text-slate-500 uppercase">
            <tr>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Change Type</th>
              <th className="px-6 py-3 font-medium">Value</th>
              <th className="px-6 py-3 font-medium">Selector</th>
              <th className="px-6 py-3 font-medium">Actions</th>
              <th className="px-6 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {patches.map((patch) => {
              const healEvt = healEvents[patch.id];
              return (
                <>
                  <tr key={patch.id} className="border-b hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        patch.status === 'live' ? 'bg-emerald-100 text-emerald-700' :
                        patch.status === 'healed' ? 'bg-blue-100 text-blue-700' :
                        patch.status === 'broken' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {patch.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono">{patch.change.type}</td>
                    <td className="px-6 py-4 truncate max-w-xs">{patch.change.value}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{patch.anchors.cssSelector}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <a
                          href={`http://localhost:4100/?preview_patch=${patch.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded text-xs font-semibold"
                          title="Open demo store in isolated preview mode"
                        >
                          👁️ Preview
                        </a>
                        {patch.status !== 'live' && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`http://localhost:4000/patches/${patch.id}/deploy`, { method: 'POST' });
                                if (res.ok) {
                                  setPatches((prev) => prev.map((p) => p.id === patch.id ? { ...p, status: 'live' } : p));
                                  alert('🚀 Patch successfully deployed to live store!');
                                }
                              } catch (e: any) {
                                alert(`Failed to deploy: ${e.message}`);
                              }
                            }}
                            className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded text-xs font-semibold"
                            title="Deploy this patch to live website"
                          >
                            🚀 Deploy
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {patch.status === 'healed' && healEvt && (
                        <button
                          onClick={() => setExpanded(expanded === patch.id ? null : patch.id)}
                          className="text-blue-600 text-xs underline hover:no-underline"
                        >
                          {expanded === patch.id ? 'Hide' : 'Why healed?'}
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Healing explanation row */}
                  {expanded === patch.id && healEvt && (
                    <tr key={`${patch.id}-heal`} className="bg-blue-50">
                      <td colSpan={5} className="px-6 py-4">
                        <div className="space-y-3">
                          <h4 className="font-semibold text-blue-800 text-sm">🩹 Auto-Heal Explanation</h4>
                          <ScoreBreakdown details={healEvt.details} />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {patches.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No patches found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoreBreakdown({ details }: { details: Record<string, unknown> }) {
  const breakdown = details.breakdown as Record<string, number> | undefined;
  const score = details.score as number | undefined;

  return (
    <div className="text-sm space-y-2">
      {score !== undefined && (
        <p className="text-blue-700">
          Overall confidence: <strong>{(score * 100).toFixed(1)}%</strong>
        </p>
      )}
      {breakdown && (
        <div className="flex gap-4 flex-wrap">
          {Object.entries(breakdown).map(([key, val]) => (
            <div key={key} className="bg-white border border-blue-200 rounded px-3 py-1 text-xs">
              <span className="text-slate-500 capitalize">{key}: </span>
              <span className="font-semibold text-blue-800">{(val * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NLPromptBox({ onCreated }: { onCreated?: (patch: Patch) => void }) {
  const [instruction, setInstruction] = useState('');
  const [context, setContext] = useState('<button id="checkout-btn" class="btn-checkout">Checkout</button>');
  const [url, setUrl] = useState('http://localhost:4100/');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<string | null>(null);
  const [createdPatch, setCreatedPatch] = useState<Patch | null>(null);

  const handleSubmit = async () => {
    if (!instruction.trim()) return;
    setStatus('loading');
    setResult(null);
    setCreatedPatch(null);

    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data?.session?.access_token;

      const res = await fetch('http://localhost:4000/ai/patch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          instruction,
          element_context: context || '<button id="checkout-btn">Checkout</button>',
          target_url: url,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Request failed');
      }

      const data = await res.json();
      setResult(`✅ Draft patch created: ${data.draft?.id ? data.draft.id.slice(0, 8) + '...' : 'Success'}`);
      setStatus('done');
      if (data.draft) {
        setCreatedPatch(data.draft);
        if (onCreated) onCreated(data.draft);
      }
    } catch (e: any) {
      setResult(`❌ ${e.message}`);
      setStatus('error');
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
        ✨ Natural Language Patch (AI)
      </h3>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Target URL"
        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 ring-indigo-300 outline-none"
      />
      <textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder="Paste element HTML context (optional)"
        rows={2}
        className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 ring-indigo-300 outline-none"
      />
      <div className="flex gap-2">
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder='e.g. "Make the checkout button red and say Buy Now"'
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 ring-indigo-300 outline-none"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          disabled={status === 'loading'}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {status === 'loading' ? 'Generating…' : 'Generate Patch'}
        </button>
      </div>
      {result && (
        <div className="pt-1 space-y-2">
          <p className={`text-xs font-mono ${status === 'done' ? 'text-emerald-700' : 'text-red-600'}`}>
            {result}
          </p>
          {createdPatch && (
            <div className="flex items-center gap-3 pt-1">
              <a
                href={`http://localhost:4100/?preview_patch=${createdPatch.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                👁️ Preview on Demo Store (Draft Mode)
              </a>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`http://localhost:4000/patches/${createdPatch.id}/deploy`, { method: 'POST' });
                    if (res.ok) {
                      alert('🚀 Draft patch deployed to live website!');
                      window.location.reload();
                    }
                  } catch (e: any) {
                    alert(`Deploy failed: ${e.message}`);
                  }
                }}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                🚀 Deploy to Live Store
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
