import { useEffect, useState } from 'react';
import { hasSupabase, supabase } from '../lib/supabase';
import type { AuditEvent } from '@patchwork/shared';

export function Audit() {
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      let loadedEvents: AuditEvent[] = [];

      if (hasSupabase && supabase) {
        try {
          const { data } = await supabase.from('audit_events').select('*').order('created_at', { ascending: false });
          if (data && data.length > 0) {
            loadedEvents = data as AuditEvent[];
          }
        } catch {
          // Fallback
        }
      }

      if (loadedEvents.length === 0) {
        try {
          const res = await fetch('http://localhost:4000/audit');
          if (res.ok) {
            const evts = await res.json();
            loadedEvents = evts as AuditEvent[];
          }
        } catch {
          // ignore
        }
      }

      setEvents(loadedEvents);
    };
    fetchEvents();

    if (hasSupabase && supabase) {
      try {
        const channel = supabase
          .channel('audit_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_events' }, fetchEvents)
          .subscribe();

        return () => { if (supabase) supabase.removeChannel(channel); };
      } catch {
        // offline
      }
    }
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Audit Trail</h1>
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <ol className="relative border-l border-slate-200 ml-3">                  
          {events.map((evt) => (
            <li key={evt.id} className="mb-8 ml-6">            
              <span className="absolute flex items-center justify-center w-3 h-3 bg-indigo-600 rounded-full -left-1.5 ring-4 ring-white"></span>
              <h3 className="mb-1 text-sm font-semibold text-slate-900 uppercase tracking-wide">{evt.event_type.replace(/_/g, ' ')}</h3>
              <time className="block mb-2 text-xs font-normal leading-none text-slate-400">
                {new Date(evt.created_at).toLocaleString()}
              </time>
              <p className="text-sm font-normal text-slate-500 font-mono">
                Entity: {evt.entity_id}
              </p>
              <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded border font-mono break-words">
                {JSON.stringify(evt.details)}
              </div>
            </li>
          ))}
          {events.length === 0 && (
             <li className="ml-6 text-slate-500">No events found</li>
          )}
        </ol>
      </div>
    </div>
  );
}
