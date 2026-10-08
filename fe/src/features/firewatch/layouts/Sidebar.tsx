import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BellRing,
  Camera,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  LayoutDashboard,
  Menu,
  Radio,
  ScrollText,
  Sliders,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { NAV_ITEMS } from '../navigation';
import { useFireWatch } from '../hooks/useFireWatch';

const ICON_MAP = {
  LayoutDashboard,
  Camera,
  Radio,
  BellRing,
  Sliders,
  FileSpreadsheet,
  SlidersHorizontal,
  ScrollText,
};

export const Sidebar: React.FC = () => {
  const { unacknowledgedCount } = useFireWatch();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  const renderIcon = (name: keyof typeof ICON_MAP, className = 'w-4 h-4') => {
    const Component = ICON_MAP[name];
    return Component ? <Component className={className} /> : null;
  };

  const navContent = (
    <div className="flex flex-col h-full bg-[#f8fafc] border-r border-slate-200 select-none">
      <div className="p-3">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
          {!isCollapsed && 'BANG DIEU KHIEN'}
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isRoot = item.path === '';
            const isActive = isRoot
              ? location.pathname === '/' || location.pathname === ''
              : location.pathname.startsWith(`/${item.path}`);

            return (
              <NavLink
                key={item.id}
                to={`/${item.path}`}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors duration-150 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                }`}
                title={item.description || item.label}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`${isActive ? 'text-white' : 'text-slate-500'}`}>
                    {renderIcon(item.iconName)}
                  </span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {item.badgeKey === 'unacknowledgedAlerts' && unacknowledgedCount > 0 && (
                  <span
                    className={`ml-2 px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full ${
                      isActive ? 'bg-red-500 text-white' : 'bg-red-600 text-white'
                    }`}
                  >
                    {unacknowledgedCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="flex-1" />

      {!isCollapsed && (
        <div className="p-3 m-3 rounded-lg bg-slate-100/90 border border-slate-200 text-[11px] font-mono text-slate-600 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">ESP32-S3:</span>
            <span className="font-bold text-slate-800">esp32-s3-01</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Bơm/coi/LED:</span>
            <span className="font-bold text-red-600">Theo telemetry</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">MQTT:</span>
            <span className="font-bold text-slate-800">EMQX</span>
          </div>
        </div>
      )}

      <div className="hidden lg:block p-3 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center justify-center w-full gap-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Thu gon menu</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden fixed bottom-4 left-4 z-40">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-3 rounded-full bg-slate-900 text-white shadow-lg border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition"
          aria-label="Mo menu dieu huong"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full bg-white shadow-2xl z-10 flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-900 text-white">
              <span className="text-xs font-bold uppercase tracking-wider">FIREWATCH MENU</span>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-1 rounded text-slate-300 hover:text-white"
                aria-label="Dong menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{navContent}</div>
          </div>
        </div>
      )}

      <aside className={`hidden lg:block shrink-0 transition-all duration-200 ${isCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="sticky top-14 h-[calc(100vh-3.5rem)]">{navContent}</div>
      </aside>
    </>
  );
};
