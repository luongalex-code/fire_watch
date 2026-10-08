import React, { useState, useRef } from 'react';
import { AIDetection } from '../../types';
import { DetectionOverlay } from './DetectionOverlay';
import { Camera, Maximize2, CheckSquare, Square, RefreshCw, AlertOctagon } from 'lucide-react';

interface CameraPlayerProps {
  cameraName?: string;
  detections?: AIDetection[];
  isOnline?: boolean;
  fps?: number;
  latencyMs?: number;
  modelName?: string;
  rtspUrl?: string;
  streamUrl?: string;
  onSnapshot?: () => void;
  className?: string;
}

export const CameraPlayer: React.FC<CameraPlayerProps> = ({
  cameraName = 'CAM-01 (Phòng Thủ Dầu Một)',
  detections = [],
  isOnline = true,
  fps,
  latencyMs,
  modelName,
  rtspUrl = 'RTSP://192.168.1.104:8554/live/ch0',
  streamUrl,
  onSnapshot,
  className = '',
}) => {
  const [showOverlay, setShowOverlay] = useState(true);
  const [showConfidence, setShowConfidence] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [streamFailed, setStreamFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canShowStream = isOnline && !streamFailed && Boolean(streamUrl);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className={`flex flex-col bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-md ${className}`}>
      {/* Video Viewport */}
      <div
        ref={containerRef}
        className="relative w-full aspect-video bg-[#090d16] flex items-center justify-center overflow-hidden"
      >
        {canShowStream ? (
          <>
            {streamUrl ? (
              <img
                src={streamUrl}
                alt={cameraName}
                className="absolute inset-0 w-full h-full object-cover"
                onLoad={() => setStreamFailed(false)}
                onError={() => setStreamFailed(true)}
              />
            ) : (
              <svg
                className="absolute inset-0 w-full h-full object-cover"
                viewBox="0 0 1920 1080"
                preserveAspectRatio="xMidYMid slice"
              >
              <defs>
                <linearGradient id="hallGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#111827" />
                  <stop offset="60%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
                <radialGradient id="fireGlow" cx="460" cy="350" r="180" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#ff4500" stopOpacity="0.8" />
                  <stop offset="40%" stopColor="#ff8c00" stopOpacity="0.5" />
                  <stop offset="70%" stopColor="#ffaa00" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#ff4500" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="smokeGlow" cx="470" cy="280" r="220" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.45" />
                  <stop offset="50%" stopColor="#64748b" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#475569" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Background Factory Walls and Ceiling Beams */}
              <rect width="1920" height="1080" fill="url(#hallGrad)" />
              <line x1="0" y1="180" x2="1920" y2="180" stroke="#334155" strokeWidth="3" />
              <line x1="300" y1="0" x2="200" y2="1080" stroke="#1e293b" strokeWidth="12" />
              <line x1="1600" y1="0" x2="1700" y2="1080" stroke="#1e293b" strokeWidth="12" />
              <line x1="960" y1="0" x2="960" y2="600" stroke="#334155" strokeWidth="4" />

              {/* Factory Floor */}
              <polygon points="0,720 1920,720 1920,1080 0,1080" fill="#0f172a" opacity="0.95" />
              <line x1="0" y1="720" x2="1920" y2="720" stroke="#475569" strokeWidth="2" />
              {/* Floor grid perspective */}
              <line x1="200" y1="720" x2="50" y2="1080" stroke="#1e293b" strokeWidth="2" />
              <line x1="600" y1="720" x2="500" y2="1080" stroke="#1e293b" strokeWidth="2" />
              <line x1="1300" y1="720" x2="1400" y2="1080" stroke="#1e293b" strokeWidth="2" />
              <line x1="1700" y1="720" x2="1850" y2="1080" stroke="#1e293b" strokeWidth="2" />
              <rect x="360" y="320" width="220" height="380" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="3" />
              <rect x="380" y="340" width="180" height="130" fill="#0f172a" stroke="#334155" strokeWidth="2" />
              <text x="390" y="375" fill="#38bdf8" fontSize="16" fontFamily="monospace">FIRE MONITORING</text>
              <rect x="380" y="490" width="180" height="190" fill="#334155" />
              <circle cx="410" cy="530" r="14" fill="#22c55e" />
              <circle cx="450" cy="530" r="14" fill="#eab308" />
              <circle cx="490" cy="530" r="14" fill="#ef4444" />

              {/* Secondary Lathe Machines */}
              <rect x="680" y="440" width="340" height="260" fill="#1e293b" stroke="#334155" strokeWidth="2" />
              <rect x="1150" y="380" width="400" height="320" fill="#1e293b" stroke="#334155" strokeWidth="2" />

              {/* Overhead Crane and Cable Trays */}
              <rect x="100" y="120" width="1720" height="30" fill="#334155" />
              <rect x="850" y="100" width="180" height="60" fill="#eab308" />
              <line x1="940" y1="160" x2="940" y2="350" stroke="#94a3b8" strokeWidth="4" />

              {/* Fire and Smoke Graphic simulation when detection occurs */}
              {detections.length > 0 && (
                <>
                  <ellipse cx="465" cy="270" rx="140" ry="110" fill="url(#smokeGlow)" />
                  <ellipse cx="460" cy="355" rx="75" ry="90" fill="url(#fireGlow)" />
                  <polygon
                    points="440,420 460,300 475,340 485,290 500,420"
                    fill="#ffcc00"
                    opacity="0.9"
                  />
                  <polygon
                    points="450,420 465,330 475,370 485,320 495,420"
                    fill="#ff3300"
                    opacity="0.95"
                  />
                </>
              )}
              </svg>
            )}

            {/* AI Bounding Box Overlay */}
            {showOverlay && (
              <DetectionOverlay
                detections={detections}
                showLabels={true}
                showConfidence={showConfidence}
                showGrid={showGrid}
                videoWidth={1920}
                videoHeight={1080}
              />
            )}

            {/* Top HUD bar */}
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-[11px] font-mono text-white/90 bg-slate-950/70 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-700/50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-bold">{cameraName}</span>
                <span className="px-1 py-0.2 bg-red-600/80 text-[10px] font-bold rounded">LIVE</span>
              </div>
              <div className="flex items-center gap-3">
                {modelName && <span className="text-slate-300 hidden md:inline">Model: {modelName}</span>}
                {typeof fps === 'number' && <span className="text-emerald-400">FPS: {fps.toFixed(1)}</span>}
                {typeof latencyMs === 'number' && <span className="text-amber-300">AI lag: {latencyMs}ms</span>}
              </div>
            </div>

            {/* Bottom HUD bar */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono text-slate-400 bg-slate-950/70 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-700/50">
              <span className="truncate max-w-xs">{streamUrl || rtspUrl}</span>
              <span className="hidden sm:inline">Camera AI stream</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <AlertOctagon className="w-10 h-10 text-red-500 mb-2" />
            <span className="text-sm font-bold text-white mb-1">MẤT TÍN HIỆU CAMERA</span>
            <span className="text-xs text-slate-400 max-w-xs">
              Chưa nhận được frame mới từ camera service. Kiểm tra camera USB, service fire_ai hoặc đường dẫn stream.
            </span>
          </div>
        )}
      </div>

      {/* Control bar under camera */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-900 border-t border-slate-800 text-xs">
        <div className="flex items-center gap-4 text-slate-300">
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-white select-none">
            <button
              type="button"
              onClick={() => setShowOverlay(!showOverlay)}
              className="text-emerald-400 focus:outline-hidden"
            >
              {showOverlay ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            </button>
            <span>Lop nhận diện AI</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer hover:text-white select-none">
            <button
              type="button"
              onClick={() => setShowConfidence(!showConfidence)}
              className="text-emerald-400 focus:outline-hidden"
            >
              {showConfidence ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            </button>
            <span>Do tin cay</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer hover:text-white select-none">
            <button
              type="button"
              onClick={() => setShowGrid(!showGrid)}
              className="text-emerald-400 focus:outline-hidden"
            >
              {showGrid ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            </button>
            <span>Luoi toa do</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          {onSnapshot && (
            <button
              type="button"
              onClick={onSnapshot}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded border border-slate-700 transition"
            >
              <Camera className="w-3.5 h-3.5 text-slate-300" />
              <span>Chup anh sự kiện</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            title="Toan man hinh"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

