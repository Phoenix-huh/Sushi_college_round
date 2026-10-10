import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Shield, Layers, Layout, GitCommit, FileText, UserCheck, Code } from 'lucide-react';
import { cn } from '../lib/utils';

export function SidebarLayout() {
  const [role, setRole] = useState<'developer' | 'reviewer'>('developer');

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-900">
      <aside className="w-64 border-r bg-white p-4 flex flex-col justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-2 py-4 font-bold text-lg border-b mb-4">
            <Shield className="w-6 h-6 text-indigo-600" />
            <div className="flex flex-col">
              <span className="leading-tight">PATCHWORK</span>
              <span className="text-[10px] text-slate-400 font-normal">Hotfix the Internet</span>
            </div>
          </div>
          
          <NavItem to="/patches" icon={<Layers className="w-4 h-4" />}>Patches</NavItem>
          <NavItem to="/deployments" icon={<Layout className="w-4 h-4" />}>Deployments</NavItem>
          <NavItem to="/verification" icon={<Shield className="w-4 h-4" />}>Verification</NavItem>
          <NavItem to="/conflicts" icon={<GitCommit className="w-4 h-4" />}>Conflicts</NavItem>
          <NavItem to="/audit" icon={<FileText className="w-4 h-4" />}>Audit</NavItem>
        </div>

        {/* Role switcher */}
        <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Active Role
          </div>
          <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-md border border-slate-200">
            <button
              onClick={() => setRole('developer')}
              className={cn(
                "flex items-center justify-center gap-1 py-1.5 px-2 rounded text-xs font-medium transition-all",
                role === 'developer'
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Code className="w-3 h-3" />
              Dev
            </button>
            <button
              onClick={() => setRole('reviewer')}
              className={cn(
                "flex items-center justify-center gap-1 py-1.5 px-2 rounded text-xs font-medium transition-all",
                role === 'reviewer'
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <UserCheck className="w-3 h-3" />
              Reviewer
            </button>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 truncate">
            {role === 'developer' ? 'dev@patchwork.io' : 'reviewer@patchwork.io'}
          </div>
        </div>
      </aside>
      
      <main className="flex-1 overflow-auto bg-slate-50/50">
        <div className="p-8 max-w-6xl mx-auto h-full">
          <Outlet context={{ role, setRole }} />
        </div>
      </main>
    </div>
  );
}

function NavItem({ to, icon, children }: { to: string, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <NavLink 
      to={to} 
      className={({isActive}) => cn(
        "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
        isActive ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-100 text-slate-600"
      )}
    >
      {icon}
      {children}
    </NavLink>
  );
}
