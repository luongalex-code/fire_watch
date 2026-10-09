import React, { useState } from 'react';
import { useFireWatch } from '../../hooks/useFireWatch';
import { Loader2, Power, Bell, Zap, Check } from 'lucide-react';

interface ActuatorCardProps {
  id: string;
  name: string;
  gpio: number;
  icon: React.ReactNode;
  currentState: boolean | null;
  isStale: boolean;
  isOffline: boolean;
  onCommand: string;
  offCommand: string;
  onLabel: string;
  offLabel: string;
  descOn: string;
  descOff: string;
  colorScheme: 'red' | 'amber' | 'emerald' | 'blue';
  lastUpdated?: string;
  onActionClick: (target: string, gpio: number, payload: string, title: string, desc: string, isDestructive: boolean) => void;
  pendingTarget?: string | null;
}

export const ActuatorCard: React.FC<ActuatorCardProps> = ({
  id,
  name,
  gpio,
  icon,
  currentState,
  isStale,
  isOffline,
  onCommand,
  offCommand,
  onLabel,
  offLabel,
  descOn,
  descOff,
  colorScheme,
  lastUpdated,
  onActionClick,
  pendingTarget
}) => {
  const isUnknown = currentState === null || currentState === undefined || isStale;
  const isPending = pendingTarget === id;
  const isDisabled = isOffline || isPending;

  const handleOn = () => {
    onActionClick(id, gpio, onCommand, `Yêu cầu ${onLabel.toLowerCase()}`, descOn, true);
  };

  const handleOff = () => {
    onActionClick(id, gpio, offCommand, `Yêu cầu ${offLabel.toLowerCase()}`, descOff, false);
  };

  // Determine button states based on Matrix
  let onBtnDisabled = isDisabled;
  let offBtnDisabled = isDisabled;
  
  if (!isUnknown && !isPending && !isOffline) {
    if (currentState === true) {
      onBtnDisabled = true;
    } else if (currentState === false) {
      offBtnDisabled = true;
    }
  }

  const renderBadge = () => {
    if (isOffline) {
      return (
        <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs bg-slate-100 px-2 py-1 rounded w-fit">
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          MẤT KẾT NỐI
        </div>
      );
    }
    if (isUnknown) {
      return (
        <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs bg-slate-100 px-2 py-1 rounded w-fit">
          <span className="text-[10px]">?</span>
          Chưa có dữ liệu
        </div>
      );
    }
    if (currentState) {
      return (
        <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs bg-emerald-100 px-2 py-1 rounded w-fit transition-colors duration-300">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          Đang bật
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-slate-600 font-bold text-xs bg-slate-100 px-2 py-1 rounded w-fit transition-colors duration-300">
        <div className="w-2 h-2 rounded-full border-2 border-slate-400" />
        Đang tắt
      </div>
    );
  };

  const colorClasses = {
    red: 'bg-red-600 hover:bg-red-700 border-red-600 focus:ring-red-500',
    amber: 'bg-amber-500 hover:bg-amber-600 border-amber-500 focus:ring-amber-400',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 focus:ring-emerald-500',
    blue: 'bg-blue-600 hover:bg-blue-700 border-blue-600 focus:ring-blue-500',
  }[colorScheme];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5 font-bold text-slate-900">
          <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
            {icon}
          </div>
          <span className="text-sm">{name}</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 font-bold px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100">GPIO{gpio}</span>
      </div>

      <div className="flex-1 space-y-3">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Trạng thái thiết bị</div>
          {renderBadge()}
          {isOffline && (
            <div className="text-[10px] text-slate-500 mt-1.5">Không thể điều khiển thiết bị</div>
          )}
          {!isOffline && lastUpdated && !isUnknown && (
            <div className="text-[10px] font-mono text-slate-400 mt-1.5">ESP32 cập nhật lúc {lastUpdated}</div>
          )}
        </div>
      </div>

      <div className="flex gap-2.5 pt-2">
        <button
          disabled={onBtnDisabled}
          title={isOffline ? "ESP32 đang mất kết nối." : isPending ? "Đang chờ lệnh trước hoàn tất." : currentState === true ? `${name} hiện đã bật.` : undefined}
          onClick={handleOn}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-bold transition-all duration-150
            ${onBtnDisabled 
              ? (currentState === true 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 cursor-not-allowed opacity-100 shadow-none'
                  : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-80 shadow-none')
              : `${colorClasses} text-white shadow-xs active:scale-[0.98] active:translate-y-[1px]`
            }`}
        >
          {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang gửi...</> : currentState === true ? <><Check className="w-3.5 h-3.5" /> ĐANG BẬT</> : onLabel.toUpperCase()}
        </button>

        <button
          disabled={offBtnDisabled}
          title={isOffline ? "ESP32 đang mất kết nối." : isPending ? "Đang chờ lệnh trước hoàn tất." : currentState === false ? `${name} hiện đã tắt.` : undefined}
          onClick={handleOff}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-bold transition-all duration-150
            ${offBtnDisabled 
              ? (currentState === false 
                  ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed opacity-100 shadow-none'
                  : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-80 shadow-none')
              : `bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-xs active:scale-[0.98] active:translate-y-[1px]`
            }`}
        >
          {isPending ? 'CHỜ...' : currentState === false ? <><Check className="w-3.5 h-3.5" /> ĐANG TẮT</> : offLabel.toUpperCase()}
        </button>
      </div>

      {isPending && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-1.5 rounded border border-amber-100 justify-center">
          <Loader2 className="w-3 h-3 animate-spin" /> Chờ ESP32 xác nhận
        </div>
      )}
    </div>
  );
};
