import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  secondaryValue?: string;
  badge?: React.ReactNode;
  trend?: {
    value: string;
    isUp?: boolean;
    isGood?: boolean;
  };
  footer?: React.ReactNode;
  alertBorder?: boolean;
  isStale?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  secondaryValue,
  badge,
  trend,
  footer,
  alertBorder = false,
  isStale = false,
  icon,
  className = '',
}) => {
  return (
    <div
      className={`relative bg-white rounded-lg border transition-all p-3.5 shadow-sm ${
        alertBorder
          ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/10'
          : 'border-slate-200 hover:border-slate-300'
      } ${isStale ? 'opacity-60 bg-slate-50' : ''} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
          {icon && <span className="text-slate-400">{icon}</span>}
          <span>{title}</span>
        </div>
        {badge}
      </div>

      <div className="flex items-baseline gap-1.5 my-1">
        <span className="font-mono text-2xl font-bold tracking-tight text-slate-900">
          {isStale ? 'Mất kết nối' : value}
        </span>
        {unit && !isStale && (
          <span className="text-sm font-medium text-slate-500">{unit}</span>
        )}
      </div>

      {(secondaryValue || trend) && !isStale && (
        <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
          {secondaryValue && <span className="font-mono">{secondaryValue}</span>}
          {trend && (
            <span
              className={`font-medium ${
                trend.isGood ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
      )}

      {footer && <div className="mt-2.5 pt-2 border-t border-slate-100">{footer}</div>}
    </div>
  );
};
