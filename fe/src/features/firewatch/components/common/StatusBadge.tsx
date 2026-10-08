import React from 'react';

interface StatusBadgeProps {
  status: string;
  variant?: 'solid' | 'outline' | 'subtle';
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'subtle',
  size = 'md',
  pulse = false,
  className = '',
  label,
}) => {
  const normalized = status.toLowerCase();

  let colors = 'bg-slate-700/60 text-slate-300 border-slate-600';
  let dotColor = 'bg-slate-400';

  if (['online', 'connected', 'synced', 'active', 'ok', 'live'].includes(normalized)) {
    colors =
      variant === 'solid'
        ? 'bg-emerald-600 text-white border-emerald-500'
        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    dotColor = 'bg-emerald-400';
  } else if (['critical', 'fire', 'error', 'estop', 'failed'].includes(normalized)) {
    colors =
      variant === 'solid'
        ? 'bg-red-600 text-white border-red-500'
        : 'bg-red-500/15 text-red-400 border-red-500/30';
    dotColor = 'bg-red-400';
  } else if (
    ['warning', 'smoke', 'pending', 'pending_ack', 'timeout'].includes(normalized)
  ) {
    colors =
      variant === 'solid'
        ? 'bg-amber-600 text-white border-amber-500'
        : 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    dotColor = 'bg-amber-400';
  } else if (['acknowledged', 'info', 'audit'].includes(normalized)) {
    colors =
      variant === 'solid'
        ? 'bg-blue-600 text-white border-blue-500'
        : 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    dotColor = 'bg-blue-400';
  } else if (['offline', 'disconnected', 'stale'].includes(normalized)) {
    colors = 'bg-slate-800 text-slate-400 border-slate-700';
    dotColor = 'bg-slate-500';
  }

  const sizeClasses =
    size === 'sm' ? 'px-1.5 py-0.5 text-[10px] gap-1' : 'px-2 py-0.5 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded border ${colors} ${sizeClasses} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${dotColor} ${
          pulse ? 'animate-ping' : ''
        }`}
      />
      <span>{label || status}</span>
    </span>
  );
};
