import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { GlobalAlertBanner } from './GlobalAlertBanner';
import { CriticalFireOverlay } from './CriticalFireOverlay';
import { ToastContainer } from '../components/common/Toast';

interface AppLayoutProps {
  onLogout?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ onLogout }) => {
  return (
    <div className="min-h-screen bg-[#f1f5f9] text-[#0f172a] flex flex-col font-sans">
      {/* Tactical Header */}
      <Header onLogout={onLogout} />

      {/* Global Alert Banner (active on unhandled critical events) */}
      <GlobalAlertBanner />

      {/* Main Body with Sidebar + Dynamic Outlet View */}
      <div className="flex-1 flex flex-row min-h-0 w-full">
        {/* Persistent 8-item Sidebar */}
        <Sidebar />

        {/* Dynamic Page Content */}
        <main className="flex-1 min-w-0 p-3 sm:p-5 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Global Toasts */}
      <CriticalFireOverlay />
      <ToastContainer />
    </div>
  );
};
