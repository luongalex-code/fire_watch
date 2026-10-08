import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle, Flame } from 'lucide-react';
import { useFireWatch } from '../hooks/useFireWatch';

export const GlobalAlertBanner: React.FC = () => {
  const { activeCriticalAlert, acknowledgeAlert } = useFireWatch();
  const [isAcknowledging, setIsAcknowledging] = React.useState(false);

  const visibleCriticalAlert =
    activeCriticalAlert &&
    activeCriticalAlert.severity === 'critical' &&
    activeCriticalAlert.status === 'new' &&
    activeCriticalAlert.isActive
      ? activeCriticalAlert
      : null;
  const bannerAlert = visibleCriticalAlert;

  if (!bannerAlert) return null;

  const isCritical = bannerAlert.severity === 'critical';
  const palette = isCritical
    ? 'bg-[#b91c1c] border-red-700 text-white'
    : 'bg-amber-500 border-amber-600 text-slate-950';
  const softButton = isCritical
    ? 'bg-white/15 hover:bg-white/25 text-white border-white/20'
    : 'bg-white/45 hover:bg-white/70 text-slate-950 border-amber-700/20';

  const handleAcknowledge = async () => {
    if (isAcknowledging) return;
    setIsAcknowledging(true);
    try {
      await acknowledgeAlert(bannerAlert.id);
    } finally {
      setIsAcknowledging(false);
    }
  };

  return (
    <div
      className={`w-full px-3 sm:px-4 py-2 border-b shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200 ${palette}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          {isCritical ? (
            <Flame className="w-4 h-4 animate-bounce" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
        </div>
        <div className="text-xs font-semibold leading-tight">
          <span className={`font-bold uppercase tracking-wider ${isCritical ? 'text-red-100' : 'text-amber-950'}`}>
            {isCritical
              ? 'CANH BAO LUA:'
              : 'CAN KIEM TRA KHOI / DAU HIEU BAT THUONG:'}
          </span>{' '}
          <span>
            {bannerAlert.areaName} - {bannerAlert.title}
          </span>
          <span
            className={`hidden md:inline font-mono text-[11px] ml-2 ${
              isCritical ? 'text-red-200' : 'text-amber-950/80'
            }`}
          >
            | {bannerAlert.timestamp}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          to={isCritical ? `/alerts/${bannerAlert.id}` : '/camera-ai'}
          className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded transition border ${softButton}`}
        >
          <span>{isCritical ? 'Xem chi tiet' : 'Xem camera'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        {isCritical && bannerAlert.status === 'new' && (
          <button
            type="button"
            onClick={handleAcknowledge}
            disabled={isAcknowledging}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-red-700 hover:bg-red-50 text-xs font-bold rounded shadow-xs transition"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Đã tiếp nhận</span>
          </button>
        )}
      </div>
    </div>
  );
};
