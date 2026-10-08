import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFireWatch } from '../hooks/useFireWatch';
import { CameraPlayer } from '../components/camera/CameraPlayer';
import { fireWatchService } from '../services';
import {
  AlertTriangle,
  Camera,
  Cpu,
  Image as ImageIcon,
  RefreshCcw,
  Sliders,
  Users,
  X,
} from 'lucide-react';

interface VisionDetectionRow {
  id: number;
  camera_device_id: number;
  alert_id?: number | null;
  frame_at: string;
  model_name: string;
  model_version?: string | null;
  detections: Array<{
    label: string;
    confidence: number;
    bbox?: Record<string, number>;
  }>;
  snapshot_path?: string | null;
  video_path?: string | null;
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const cameraServiceUrl = (import.meta.env.VITE_CAMERA_SERVICE_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');

const formatCaptureTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}:${part('second')}`;
};

const captureDateKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const bestDetection = (row: VisionDetectionRow) => {
  return [...(row.detections || [])].sort((a, b) => Number(b.confidence) - Number(a.confidence))[0];
};

const detectionLabel = (label: string) => {
  const normalized = label.trim().toLowerCase();
  if (normalized === 'fire') return 'Lua';
  if (normalized === 'smoke') return 'Khoi';
  return label;
};

const displayModelName = (modelName?: string | null) => {
  if (!modelName) return 'Chưa có dữ liệu';
  const normalized = modelName.trim().toLowerCase();
  if (normalized.endsWith('.pt')) return 'YOLO Fire/Smoke custom model';
  return modelName;
};

const detectionTypes = (row: VisionDetectionRow) => {
  return Array.from(
    new Set((row.detections || []).map((item) => detectionLabel(String(item.label))))
  ).filter(Boolean);
};

const toCaptureUrl = (snapshotPath?: string | null) => {
  if (!snapshotPath) return '';
  if (/^https?:\/\//i.test(snapshotPath)) return snapshotPath;
  const normalized = snapshotPath.replace(/\\/g, '/');
  const fileName = normalized.split('/').pop();
  return fileName ? `${cameraServiceUrl}/captures/${encodeURIComponent(fileName)}` : '';
};

export const CameraAIPage: React.FC = () => {
  const { alerts, systemStatus } = useFireWatch();
  const cameraStreamUrl = import.meta.env.VITE_CAMERA_STREAM_URL || 'http://127.0.0.1:8090/stream';
  const [confFire, setConfFire] = useState(0.55);
  const [confSmoke, setConfSmoke] = useState(0.50);
  const [consecutiveFrames, setConsecutiveFrames] = useState(5);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [captures, setCaptures] = useState<VisionDetectionRow[]>([]);
  const [captureError, setCaptureError] = useState('');
  const [isLoadingCaptures, setIsLoadingCaptures] = useState(false);
  const [captureDateFilter, setCaptureDateFilter] = useState('');
  const [captureTypeFilter, setCaptureTypeFilter] = useState<'all' | 'fire' | 'smoke'>('all');
  const [visibleCaptureCount, setVisibleCaptureCount] = useState(5);
  const [selectedCapture, setSelectedCapture] = useState<VisionDetectionRow | null>(null);
  const [personEnabled, setPersonEnabled] = useState(true);
  const [personConfidence, setPersonConfidence] = useState(0.5);
  const [personIntervalFrames, setPersonIntervalFrames] = useState(3);
  const [isSavingPersonSettings, setIsSavingPersonSettings] = useState(false);
  const [personSettingsMessage, setPersonSettingsMessage] = useState('');

  const latestAlertDetections = alerts[0]?.detections || [];
  const personDetection = systemStatus.personDetection;

  const loadCaptures = useCallback(async () => {
    setIsLoadingCaptures(true);
    setCaptureError('');
    try {
      const response = await fetch(`${apiBaseUrl}/api/vision/detections?limit=100`);
      if (!response.ok) {
        throw new Error(`API ${response.status}`);
      }
      const rows = (await response.json()) as VisionDetectionRow[];
      setCaptures(
        rows
          .filter((row) => Boolean(row.snapshot_path))
          .sort((a, b) => new Date(b.frame_at).getTime() - new Date(a.frame_at).getTime())
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không tải được lich su capture';
      setCaptureError(message);
    } finally {
      setIsLoadingCaptures(false);
    }
  }, []);

  useEffect(() => {
    void loadCaptures();
    const interval = window.setInterval(() => void loadCaptures(), 8000);
    return () => window.clearInterval(interval);
  }, [loadCaptures]);

  useEffect(() => {
    fireWatchService.getSettings().then((settings) => {
      setConfFire(settings.aiConfidenceFireThreshold);
      setConfSmoke(settings.aiConfidenceSmokeThreshold);
      setConsecutiveFrames(settings.aiConsecutiveFrames);
    }).catch(() => {
      setSettingsMessage('Không tải được cau hinh suy luan từ backend.');
    });
  }, []);

  useEffect(() => {
    if (!personDetection) return;

    setPersonEnabled(Boolean(personDetection.enabled));
    if (typeof personDetection.confidenceThreshold === 'number') {
      setPersonConfidence(personDetection.confidenceThreshold);
    }
    if (typeof personDetection.intervalFrames === 'number') {
      setPersonIntervalFrames(personDetection.intervalFrames);
    }
  }, [
    personDetection?.enabled,
    personDetection?.confidenceThreshold,
    personDetection?.intervalFrames,
  ]);

  const handleSaveInferenceSettings = async () => {
    setIsSavingSettings(true);
    setSettingsMessage('');
    try {
      await fireWatchService.saveSettings({
        aiConfidenceFireThreshold: confFire,
        aiConfidenceSmokeThreshold: confSmoke,
        aiConsecutiveFrames: consecutiveFrames,
      });
      setSettingsMessage('Da luu cau hinh suy luan vao PostgreSQL.');
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Không lưu được cau hinh suy luan.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSavePersonSettings = async () => {
    setIsSavingPersonSettings(true);
    setPersonSettingsMessage('');
    try {
      const response = await fetch(`${cameraServiceUrl}/person/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: personEnabled,
          confidence_threshold: personConfidence,
          interval_frames: personIntervalFrames,
        }),
      });

      if (!response.ok) {
        throw new Error(`Camera service ${response.status}`);
      }

      const payload = await response.json();
      if (payload?.ok === false) {
        throw new Error(payload.error || 'Camera service không lưu được cấu hình người.');
      }

      setPersonSettingsMessage('Đã lưu cấu hình nhận diện người vào camera service.');
    } catch (error) {
      setPersonSettingsMessage(
        error instanceof Error ? error.message : 'Không lưu được cấu hình nhận diện người.'
      );
    } finally {
      setIsSavingPersonSettings(false);
    }
  };

  const captureStats = useMemo(() => {
    const total = captures.length;
    const fire = captures.filter((row) =>
      row.detections.some((item) => item.label.toLowerCase() === 'fire')
    ).length;
    const smoke = captures.filter((row) =>
      row.detections.some((item) => item.label.toLowerCase() === 'smoke')
    ).length;
    return { total, fire, smoke };
  }, [captures]);

  const filteredCaptures = useMemo(() => {
    return captures.filter((row) => {
      const matchesDate = !captureDateFilter || captureDateKey(row.frame_at) === captureDateFilter;
      const matchesType =
        captureTypeFilter === 'all' ||
        row.detections.some((item) => String(item.label).toLowerCase() === captureTypeFilter);
      return matchesDate && matchesType;
    });
  }, [captureDateFilter, captureTypeFilter, captures]);

  const visibleCaptures = filteredCaptures.slice(0, visibleCaptureCount);
  const canShowMoreCaptures = visibleCaptureCount < filteredCaptures.length;
  const latestModelName = captures[0]?.model_name || '';

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="bg-[#0f172a] text-white p-4 rounded-xl border border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">
              Camera AI Fire/Smoke
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Camera service nhận diện lửa/khói, lưu capture va gửi sự kiện về backend.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadCaptures()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          Tai lai capture
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border border-slate-200 bg-white">
          <div className="text-xs text-slate-500 font-bold mb-1">CAMERA LIVE</div>
          <div className="flex items-baseline justify-between">
            <span className="font-bold text-slate-900 text-sm">CAM-01</span>
            <span className="font-mono text-base font-bold text-emerald-700">
              {systemStatus.camera === 'live' ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">Phòng Thủ Dầu Một</div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 bg-white">
          <div className="text-xs text-slate-500 font-bold mb-1">MO HINH AI</div>
          <div className="flex items-baseline justify-between">
            <span className="font-bold text-slate-900 text-sm truncate">
              {displayModelName(latestModelName)}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
              {systemStatus.camera === 'live' ? 'Co frame' : 'Chưa live'}
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">Lay tu bang vision_detections</div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 bg-white">
          <div className="text-xs text-slate-500 font-bold mb-1">CAPTURE DA LUU</div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-xl font-bold text-slate-900">{captureStats.total}</span>
            <span className="text-[11px] text-slate-500">
              Lua {captureStats.fire} / Khoi {captureStats.smoke}
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">Lay tu bang vision_detections</div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 bg-white">
          <div className="text-xs text-slate-500 font-bold mb-1">NHẬN DIỆN NGƯỜI</div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-xl font-bold text-slate-900">
              {personDetection?.enabled ? personDetection.personCount : 0}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              personDetection?.status === 'online'
                ? 'bg-emerald-50 text-emerald-700'
                : personDetection?.status === 'error'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-slate-100 text-slate-600'
            }`}>
              {personDetection?.enabled ? personDetection.status : 'disabled'}
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">
            {personDetection?.updatedAt
              ? `Cập nhật ${formatCaptureTime(personDetection.updatedAt)}`
              : 'Chưa có dữ liệu'}
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold">Quy tac van hanh:</strong> AI chi tao bang chung hinh anh va sự kiện.
          Lệnh bơm vẫn đi theo luồng xác nhận kép backend: camera AI và cảm biến ESP32 cũng active trong cùng khu vực.
          Nhận diện người chỉ hiển thị trên camera, không tạo cảnh báo cháy và không tham gia điều kiện bật bơm.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-4">
          <CameraPlayer
            cameraName="CAM-01 (Phòng Thủ Dầu Một)"
            detections={latestAlertDetections}
            isOnline={systemStatus.camera === 'live'}
            streamUrl={cameraStreamUrl}
          />

          {(captureError || captures.length > 0) && (
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-slate-700" />
                  Capture & lich su nhận diện
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <input
                    type="date"
                    value={captureDateFilter}
                    onChange={(event) => {
                      setCaptureDateFilter(event.target.value);
                      setVisibleCaptureCount(5);
                    }}
                    className="h-8 rounded border border-slate-300 px-2 text-xs text-slate-700"
                    aria-label="Loc capture theo ngay"
                  />
                  <select
                    value={captureTypeFilter}
                    onChange={(event) => {
                      setCaptureTypeFilter(event.target.value as 'all' | 'fire' | 'smoke');
                      setVisibleCaptureCount(5);
                    }}
                    className="h-8 rounded border border-slate-300 px-2 text-xs text-slate-700"
                    aria-label="Loc capture theo loai phát hiện"
                  >
                    <option value="all">Tất cả</option>
                    <option value="fire">Lua</option>
                    <option value="smoke">Khoi</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void loadCaptures()}
                    disabled={isLoadingCaptures}
                    className="inline-flex h-8 items-center gap-1 rounded bg-slate-900 px-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Thu lai
                  </button>
                </div>
              </div>

              {captureError ? (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <div className="font-bold">Không tải được lich su capture.</div>
                  <div className="mt-1 font-mono">{captureError}</div>
                </div>
              ) : (
                <>
                  {filteredCaptures.length === 0 ? (
                    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      Không có capture phù hợp với bộ lọc hiện tại.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 rounded border border-slate-200 overflow-hidden">
                      {visibleCaptures.map((row) => {
                        const best = bestDetection(row);
                        const captureUrl = toCaptureUrl(row.snapshot_path);
                        const labels = detectionTypes(row);
                        const bestLabel = best ? detectionLabel(String(best.label)) : '';
                        const bestConfidence = best ? `${(Number(best.confidence) * 100).toFixed(1)}%` : '';

                        return (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => setSelectedCapture(row)}
                            className="w-full flex gap-3 p-3 text-left hover:bg-slate-50 transition"
                          >
                            <div className="h-20 w-32 shrink-0 overflow-hidden rounded bg-slate-900 border border-slate-200 flex items-center justify-center">
                              {captureUrl ? (
                                <img src={captureUrl} alt={`Capture ${row.id}`} className="h-full w-full object-cover" />
                              ) : (
                                <Camera className="w-6 h-6 text-slate-500" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {labels.length > 0 && (
                                  <span className="text-xs font-bold text-slate-900">
                                    {labels.join(' / ')}
                                  </span>
                                )}
                                {bestConfidence && (
                                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-700">
                                    Do tin cay {bestConfidence}
                                  </span>
                                )}
                                {row.alert_id && (
                                  <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-mono font-bold text-red-700">
                                    #EV-{String(row.alert_id).padStart(4, '0')}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500">{formatCaptureTime(row.frame_at)}</div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                                {bestLabel && <span>Loai chinh: {bestLabel}</span>}
                                {row.detections.length > 0 && <span>So doi tuong: {row.detections.length}</span>}
                                {row.model_name && <span>Mo hinh: {displayModelName(row.model_name)}</span>}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {canShowMoreCaptures && (
                    <button
                      type="button"
                      onClick={() => setVisibleCaptureCount((value) => value + 5)}
                      className="w-full rounded border border-slate-300 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Xem them
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-slate-700" />
                Cấu hình ngưỡng suy luận
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                Runtime Params
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Ngưỡng confidence lửa</span>
                <span className="font-mono font-bold text-red-600">{confFire.toFixed(2)} ({(confFire * 100).toFixed(0)}%)</span>
              </div>
              <input
                type="range"
                min="0.30"
                max="0.95"
                step="0.05"
                value={confFire}
                onChange={(event) => setConfFire(parseFloat(event.target.value))}
                className="w-full accent-red-600 cursor-pointer"
              />
              <div className="text-[10px] text-slate-400 mt-1">Khuyen dung: 0.70 - 0.85 de giam bao nham.</div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Ngưỡng confidence khói</span>
                <span className="font-mono font-bold text-amber-600">{confSmoke.toFixed(2)} ({(confSmoke * 100).toFixed(0)}%)</span>
              </div>
              <input
                type="range"
                min="0.30"
                max="0.90"
                step="0.05"
                value={confSmoke}
                onChange={(event) => setConfSmoke(parseFloat(event.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="text-[10px] text-slate-400 mt-1">Khuyen dung: 0.55 - 0.75 de tranh nham bui/hoi nuoc.</div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Frame xác nhận lien tiep</span>
                <span className="font-mono font-bold text-slate-900">{consecutiveFrames} frames</span>
              </div>
              <input
                type="range"
                min="2"
                max="15"
                step="1"
                value={consecutiveFrames}
                onChange={(event) => setConsecutiveFrames(parseInt(event.target.value, 10))}
                className="w-full accent-slate-800 cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveInferenceSettings}
              disabled={isSavingSettings}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition"
            >
              {isSavingSettings ? 'Dang luu...' : 'Luu cau hinh tham so'}
            </button>
            {settingsMessage && (
              <div className="text-[11px] text-slate-500">{settingsMessage}</div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-700" />
                Nhận diện người
              </h3>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                personDetection?.status === 'online'
                  ? 'bg-emerald-50 text-emerald-700'
                  : personDetection?.status === 'error'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-slate-100 text-slate-600'
              }`}>
                {personDetection?.enabled ? personDetection.status : 'disabled'}
              </span>
            </div>

            <label className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-700">Bật nhận diện người</span>
              <input
                type="checkbox"
                checked={personEnabled}
                onChange={(event) => setPersonEnabled(event.target.checked)}
                className="h-4 w-4 accent-slate-900"
              />
            </label>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Ngưỡng confidence người</span>
                <span className="font-mono font-bold text-cyan-700">
                  {personConfidence.toFixed(2)} ({(personConfidence * 100).toFixed(0)}%)
                </span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.95"
                step="0.05"
                value={personConfidence}
                onChange={(event) => setPersonConfidence(parseFloat(event.target.value))}
                className="w-full accent-cyan-700 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Chu kỳ chạy YOLO người</span>
                <span className="font-mono font-bold text-slate-900">
                  {personIntervalFrames} frame
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={personIntervalFrames}
                onChange={(event) => setPersonIntervalFrames(parseInt(event.target.value, 10))}
                className="w-full accent-slate-800 cursor-pointer"
              />
              <div className="text-[10px] text-slate-400 mt-1">
                Chỉ giảm tần suất YOLO người, không giảm luồng lửa/khói.
              </div>
            </div>

            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
              <div>
                Số người trong frame: <span className="font-mono font-bold text-slate-900">{personDetection?.personCount ?? 0}</span>
              </div>
              {typeof personDetection?.latencyMs === 'number' && (
                <div>Độ trễ nhận diện người: <span className="font-mono">{personDetection.latencyMs}ms</span></div>
              )}
              {personDetection?.modelName && (
                <div>Model người: <span className="font-mono">{personDetection.modelName}</span></div>
              )}
              {personDetection?.updatedAt && (
                <div>Cập nhật: <span className="font-mono">{formatCaptureTime(personDetection.updatedAt)}</span></div>
              )}
              {personDetection?.error && (
                <div className="text-red-700">Lỗi: <span className="font-mono">{personDetection.error}</span></div>
              )}
            </div>

            {personDetection?.detections && personDetection.detections.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-500">Người trong frame gần nhất</div>
                {personDetection.detections.slice(0, 4).map((item, index) => (
                  <div key={`person_${index}`} className="rounded border border-slate-200 p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Person #{index + 1}</span>
                      <span className="font-mono text-slate-700">
                        {(Number(item.confidence) * 100).toFixed(1)}%
                      </span>
                    </div>
                    {item.bbox && (
                      <div className="mt-1 font-mono text-[10px] text-slate-500">
                        bbox: {Object.entries(item.bbox).map(([key, value]) => `${key}=${Number(value).toFixed(1)}`).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleSavePersonSettings}
              disabled={isSavingPersonSettings}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition"
            >
              {isSavingPersonSettings ? 'Đang lưu...' : 'Lưu cấu hình nhận diện người'}
            </button>
            {personSettingsMessage && (
              <div className="text-[11px] text-slate-500">{personSettingsMessage}</div>
            )}
          </div>
        </div>
      </div>

      {selectedCapture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-lg bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Chi tiet capture AI</h3>
                <p className="text-[11px] font-mono text-slate-500">
                  {formatCaptureTime(selectedCapture.frame_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCapture(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
                aria-label="Dong chi tiet capture"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 p-4">
              <div className="lg:col-span-3 rounded bg-slate-950 overflow-hidden flex items-center justify-center">
                {toCaptureUrl(selectedCapture.snapshot_path) ? (
                  <img
                    src={toCaptureUrl(selectedCapture.snapshot_path)}
                    alt={`Capture ${selectedCapture.id}`}
                    className="max-h-[65vh] w-full object-contain"
                  />
                ) : (
                  <div className="aspect-video w-full flex items-center justify-center text-slate-500">
                    <Camera className="w-10 h-10" />
                  </div>
                )}
              </div>

              <div className="lg:col-span-2 space-y-4 text-sm">
                <div className="rounded border border-slate-200 p-3 space-y-2">
                  <div className="text-xs font-bold uppercase text-slate-500">Thông tin chinh</div>
                  {detectionTypes(selectedCapture).length > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Loai phát hiện</span>
                      <span className="font-bold text-slate-900">{detectionTypes(selectedCapture).join(' / ')}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Ngay gio chup</span>
                    <span className="font-mono text-right text-slate-900">{formatCaptureTime(selectedCapture.frame_at)}</span>
                  </div>
                  {selectedCapture.model_name && (
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Ten mo hinh</span>
                      <span className="text-right font-medium text-slate-900">{displayModelName(selectedCapture.model_name)}</span>
                    </div>
                  )}
                  {selectedCapture.alert_id && (
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Mã cảnh báo</span>
                      <span className="font-mono font-bold text-red-700">
                        #EV-{String(selectedCapture.alert_id).padStart(4, '0')}
                      </span>
                    </div>
                  )}
                  {selectedCapture.detections.length > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">So doi tuong</span>
                      <span className="font-mono font-bold text-slate-900">{selectedCapture.detections.length}</span>
                    </div>
                  )}
                </div>

                {selectedCapture.detections.length > 0 && (
                  <div className="rounded border border-slate-200 p-3 space-y-2">
                    <div className="text-xs font-bold uppercase text-slate-500">
                      Doi tuong nhận diện
                    </div>
                    <div className="space-y-2">
                      {selectedCapture.detections.map((item, index) => (
                        <div key={`${item.label}_${index}`} className="rounded bg-slate-50 p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">{detectionLabel(String(item.label))}</span>
                            <span className="font-mono text-slate-700">
                              Do tin cay {(Number(item.confidence) * 100).toFixed(1)}%
                            </span>
                          </div>
                          {item.bbox && (
                            <div className="mt-1 font-mono text-[10px] text-slate-500">
                              bbox: {Object.entries(item.bbox).map(([key, value]) => `${key}=${Number(value).toFixed(1)}`).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


