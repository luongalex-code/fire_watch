import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { FireWatchProvider } from './context/FireWatchProvider';
import { AppLayout } from './layouts/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { CameraAIPage } from './pages/CameraAIPage';
import { SensorsPage } from './pages/SensorsPage';
import { AlertsPage } from './pages/AlertsPage';
import { AlertDetailPage } from './pages/AlertDetailPage';
import { DevicesPage } from './pages/DevicesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LogsPage } from './pages/LogsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import './firewatch.css';

export interface FireWatchAppProps {
  basePath?: string;
  currentUser?: {
    id: number;
    email: string;
    full_name?: string | null;
    role: string;
  } | null;
  onLogout?: () => void;
}

export const FireWatchApp: React.FC<FireWatchAppProps> = ({ currentUser, onLogout }) => {
  return (
    <div className="firewatch-app w-full min-h-screen text-slate-900 bg-[#f1f5f9]">
      <FireWatchProvider currentUser={currentUser}>
        <Routes>
          <Route path="/" element={<AppLayout onLogout={onLogout} />}>
            <Route index element={<OverviewPage />} />
            <Route path="camera" element={<CameraAIPage />} />
            <Route path="sensors" element={<SensorsPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="alerts/:eventId" element={<AlertDetailPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </FireWatchProvider>
    </div>
  );
};

export default FireWatchApp;
