import React from 'react';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface TimelineStep {
  time: string;
  stepTitle: string;
  description: string;
  actor?: string;
}

interface EventTimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ steps, className = '' }) => {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
        <span className="flex items-center gap-1.5 uppercase tracking-wider text-slate-700 font-bold">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          Dong thoi gian Dieu tra & Dien tien Sự kiện
        </span>
        <span className="font-mono text-[11px]">UTC+7 Vietnam Standard Time</span>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {steps.map((step, idx) => {
          const isLatest = idx === steps.length - 1;
          return (
            <div key={idx} className="relative group">
              {/* Dot */}
              <div
                className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                  isLatest
                    ? 'border-red-600 ring-2 ring-red-500/20'
                    : 'border-slate-400 group-hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${isLatest ? 'bg-red-600' : 'bg-slate-400'}`}
                />
              </div>

              {/* Content */}
              <div className="bg-slate-50/80 hover:bg-slate-50 p-3 rounded-lg border border-slate-200 transition">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-900">{step.stepTitle}</span>
                  <span className="font-mono text-[11px] font-bold text-red-600 bg-red-100/60 px-1.5 py-0.2 rounded">
                    {step.time}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-1.5">{step.description}</p>
                {step.actor && (
                  <div className="text-[10px] font-mono text-slate-400">
                    Chu the tac dong: <span className="text-slate-600 font-semibold">{step.actor}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
