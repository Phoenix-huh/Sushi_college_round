import { useEffect, useState } from 'react';
import { hasSupabase, supabase } from '../lib/supabase';
import type { Deployment, Version } from '@patchwork/shared';

export function Deployments() {
  const [deployments, setDeployments] = useState<(Deployment & { versions: Version })[]>([]);

  useEffect(() => {
    const fetchDeployments = async () => {
      let loaded: any[] = [];

      if (hasSupabase && supabase) {
        try {
          const { data } = await supabase
            .from('deployments')
            .select(`*, versions (*)`)
            .order('deployed_at', { ascending: false });
          if (data && data.length > 0) {
            loaded = data;
          }
        } catch {
          // Fallback
        }
      }

      if (loaded.length === 0) {
        try {
          const res = await fetch('http://localhost:4000/deployments');
          if (res.ok) {
            const list = await res.json();
            loaded = list;
          }
        } catch {
          // ignore
        }
      }

      setDeployments(loaded);
    };

    fetchDeployments();

    if (hasSupabase && supabase) {
      try {
        const channel = supabase
          .channel('deployments_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'deployments' }, () => {
            fetchDeployments();
          })
          .subscribe();

        return () => {
          if (supabase) supabase.removeChannel(channel);
        };
      } catch {
        // offline
      }
    }
  }, []);

  const handleRollback = async () => {
    const session = await supabase?.auth.getSession();
    const token = session?.data?.session?.access_token || '';

    await fetch('http://localhost:4000/rollback', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Deployments</h1>
        <button 
          onClick={handleRollback}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          Rollback Live
        </button>
      </div>
      
      <div className="grid gap-4">
        {deployments.map((dep) => (
          <div key={dep.id} className="bg-white p-6 rounded-lg border shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-semibold text-lg">Version {dep.versions?.number || 'Unknown'}</h3>
                {dep.is_live && (
                  <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium">LIVE</span>
                )}
                {dep.rolled_back_at && (
                  <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">ROLLED BACK</span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                Deployed at: {new Date(dep.deployed_at).toLocaleString()}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Patches included: {dep.versions?.patch_ids?.length || 0}
              </p>
            </div>
            <div className="text-right">
              <span className={`text-sm font-medium ${
                dep.versions?.verification_status === 'passed' ? 'text-emerald-600' :
                dep.versions?.verification_status === 'failed' ? 'text-red-600' :
                'text-yellow-600'
              }`}>
                Verification: {dep.versions?.verification_status?.toUpperCase() || 'PENDING'}
              </span>
            </div>
          </div>
        ))}
        {deployments.length === 0 && (
          <div className="bg-white p-8 rounded-lg border text-center text-slate-500">
            No deployments found
          </div>
        )}
      </div>
    </div>
  );
}
