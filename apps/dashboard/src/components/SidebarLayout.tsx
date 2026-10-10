import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Shield, Layers, Layout, GitCommit, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

export function SidebarLayout() {
  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-900">
      <aside className="w-64 border-r bg-white p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 px-2 py-4 font-bold text-lg border-b mb-4">
          <Shield className="w-6 h-6 text-indigo-600" />
          <span>PATCHWORK</span>
        </div>
        
        <NavItem to="/patches" icon={<Layers className="w-4 h-4" />}>Patches</NavItem>
        <NavItem to="/deployments" icon={<Layout className="w-4 h-4" />}>Deployments</NavItem>
        <NavItem to="/verification" icon={<Shield className="w-4 h-4" />}>Verification</NavItem>
        <NavItem to="/conflicts" icon={<GitCommit className="w-4 h-4" />}>Conflicts</NavItem>
        <NavItem to="/audit" icon={<FileText className="w-4 h-4" />}>Audit</NavItem>
      </aside>
      
      <main className="flex-1 overflow-auto bg-slate-50/50">
        <div className="p-8 max-w-6xl mx-auto h-full">
          <Outlet />
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
