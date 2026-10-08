import React from 'react';
import { AIDetection } from '../../types';

interface DetectionOverlayProps {
  detections: AIDetection[];
  showLabels?: boolean;
  showConfidence?: boolean;
  showGrid?: boolean;
  videoWidth?: number;
  videoHeight?: number;
}

export const DetectionOverlay: React.FC<DetectionOverlayProps> = ({
  detections,
  showLabels = true,
  showConfidence = true,
  showGrid = false,
  videoWidth = 1920,
  videoHeight = 1080,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
      {/* Optional coordinate grid overlay */}
      {showGrid && (
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)',
            backgroundSize: '8% 8%',
          }}
        />
      )}

      {/* Render AI Bounding Boxes */}
      {detections.map((det) => {
        const [x, y, w, h] = det.bbox;
        const leftPercent = (x / videoWidth) * 100;
        const topPercent = (y / videoHeight) * 100;
        const widthPercent = (w / videoWidth) * 100;
        const heightPercent = (h / videoHeight) * 100;

        const isFire = det.class === 'fire';
        const borderColor = isFire ? 'border-red-500 bg-red-500/10' : 'border-amber-400 bg-amber-400/10';
        const badgeBg = isFire ? 'bg-red-600' : 'bg-amber-600';

        return (
          <div
            key={det.id}
            style={{
              left: `${leftPercent}%`,
              top: `${topPercent}%`,
              width: `${widthPercent}%`,
              height: `${heightPercent}%`,
            }}
            className={`absolute border-2 ${borderColor} transition-all duration-300 shadow-sm`}
          >
            {/* Center crosshair */}
            <div className="absolute inset-0 flex items-center justify-center opacity-40">
              <div className="w-2 h-0.5 bg-white" />
              <div className="h-2 w-0.5 bg-white absolute" />
            </div>

            {/* Top label badge */}
            {showLabels && (
              <div
                className={`absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white whitespace-nowrap shadow-md ${badgeBg}`}
              >
                <span>{isFire ? '🔥 FIRE' : '💨 SMOKE'}</span>
                {showConfidence && (
                  <span className="ml-1 opacity-90">: {(det.confidence * 100).toFixed(1)}%</span>
                )}
                <span className="ml-1 text-[9px] opacity-75 hidden sm:inline">
                  [x:{x} y:{y} w:{w} h:{h}]
                </span>
              </div>
            )}

            {/* Timestamp tag bottom right */}
            {det.timestamp && (
              <div className="absolute -bottom-4 right-0 px-1 py-0.2 rounded text-[8px] font-mono bg-black/75 text-slate-300">
                T: {det.timestamp}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
