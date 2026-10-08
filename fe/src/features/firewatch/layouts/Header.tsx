import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronDown, Clock, Cpu, LogOut, ShieldAlert, User, Video, Wifi } from 'lucide-react';
import { useFireWatch } from '../hooks/useFireWatch';
import { AreaId } from '../types';

interface HeaderProps {
  onLogout?: () => void;
}

const formatFrameAge = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return `${value.toFixed(1)}s`;
};

export const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  const {
    currentAreaId,
    setCurrentAreaId,
    areas,
    isMock,
    operator,
    systemStatus,
    unacknowledgedCount,
  } = useFireWatch();

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0b1329] text-white border-b border-slate-800 shadow-md">
      <div className="flex items-center justify-between h-14 px-3 sm:px-4 gap-2">
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-xs shadow-red-500/30 group-hover:bg-red-500 transition">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="hidden lg:block leading-tight">
              <h1 className="text-sm font-bold tracking-tight text-white">
                FIREWATCH - GIÁM SÁT HO TRO CHUA CHAY
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                ESP32-S3 + Camera AI + Backend + MQTT
              </p>
            </div>
            <div className="block lg:hidden">
              <span className="text-sm font-bold tracking-tight text-white">FIREWATCH</span>
            </div>
          </Link>

          {isMock && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>API CHUA SAN SANG</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative inline-block text-left">
            <label className="text-[10px] font-mono text-slate-400 uppercase mr-1.5 hidden xl:inline">
              Khu vực:
            </label>
            <div className="inline-flex items-center bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-white">
              <select
                value={currentAreaId}
                onChange={(event) => setCurrentAreaId(event.target.value as AreaId)}
                aria-label="Chon khu vực giám sát"
                className="bg-transparent text-xs font-semibold text-white focus:outline-hidden cursor-pointer pr-4 appearance-none"
              >
                {areas.length === 0 ? (
                  <option value={currentAreaId} className="bg-slate-900 text-white">
                    Chưa có khu vực
                  </option>
                ) : (
                  areas.map((area) => (
                    <option key={area.id} value={area.id} className="bg-slate-900 text-white">
                      {area.name}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 -ml-3 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <div className="hidden md:flex items-center gap-2 font-mono text-[11px]">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/80 border border-slate-800">
              <Cpu className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400">ESP32-S3:</span>
              {systemStatus.esp32 === 'connected' ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Ket noi
                </span>
              ) : (
                <span className="text-red-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Mất kết nối
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/80 border border-slate-800">
              <Video className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400">CAM-01:</span>
              {systemStatus.camera === 'live' ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Co frame mới
                  {formatFrameAge(systemStatus.cameraFrameAgeSeconds) && (
                    <span className="text-slate-400 font-normal">
                      ({formatFrameAge(systemStatus.cameraFrameAgeSeconds)})
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-red-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Mat luong
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/80 border border-slate-800">
              <Wifi className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400">MQTT/WS:</span>
              {systemStatus.mqtt === 'synced' ? (
                <span className="text-emerald-400 font-bold">Dong bo</span>
              ) : (
                <span className="text-red-400 font-bold">Mat dong bo</span>
              )}
            </div>
          </div>

          <div className="hidden lg:flex flex-col text-right font-mono text-[11px] leading-tight text-slate-300 pl-1 border-l border-slate-800">
            <span className="font-bold text-white flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              {systemStatus.lastSyncTime}
            </span>
            <span className="text-[9px] text-slate-400">UTC+7 Asia/Bangkok</span>
          </div>

          <Link
            to="/alerts"
            className="relative p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition"
            title="Xem danh sach cảnh báo"
          >
            <Bell className="w-4 h-4" />
            {unacknowledgedCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 text-[9px] font-bold font-mono text-white bg-red-600 rounded-full shadow-xs">
                {unacknowledgedCount}
              </span>
            )}
          </Link>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden xl:block text-left leading-none">
              <div className="text-xs font-bold text-white">{operator.name}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{operator.role}</div>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-red-600 hover:border-red-500 transition"
                title="Dang xuat"
                aria-label="Dang xuat"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
