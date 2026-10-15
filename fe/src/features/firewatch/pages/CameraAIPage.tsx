import React, { useEffect, useState } from 'react';
import { useFireWatch } from '../hooks/useFireWatch';
import { CameraPlayer } from '../components/camera/CameraPlayer';
import { CaptureHistory, CaptureSummary } from '../components/camera/CaptureHistory';
import { fireWatchService } from '../services';
import { modelLabel } from '../utils/modelLabels';
import {
  Cpu,
  RefreshCcw,
  Sliders,
  Users,
} from 'lucide-react';


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

const displayModelName = modelLabel;

export const CameraAIPage: React.FC = () => {
  const { alerts, systemStatus } = useFireWatch();
  const cameraStreamUrl = import.meta.env.VITE_CAMERA_STREAM_URL || 'http://127.0.0.1:8090/stream';
  const [confFire, setConfFire] = useState(0.55);
  const [confSmoke, setConfSmoke] = useState(0.50);
  const [consecutiveFrames, setConsecutiveFrames] = useState(5);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [captureReload, setCaptureReload] = useState(0);
  const [captureSummary, setCaptureSummary] = useState<CaptureSummary>({ images: 0, groups: 0, model: '' });
  const [personEnabled, setPersonEnabled] = useState(true);
  const [personConfidence, setPersonConfidence] = useState(0.5);
  const [personIntervalFrames, setPersonIntervalFrames] = useState(3);
  const [isSavingPersonSettings, setIsSavingPersonSettings] = useState(false);
  const [personSettingsMessage, setPersonSettingsMessage] = useState('');

  const latestAlertDetections = alerts[0]?.detections || [];
  const personDetection = systemStatus.personDetection;



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
      const saved = await fireWatchService.saveSettings({
        aiConfidenceFireThreshold: confFire,
        aiConfidenceSmokeThreshold: confSmoke,
        aiConsecutiveFrames: consecutiveFrames,
      });
      setConfFire(saved.aiConfidenceFireThreshold);
      setConfSmoke(saved.aiConfidenceSmokeThreshold);
      setConsecutiveFrames(saved.aiConsecutiveFrames);
      window.dispatchEvent(new CustomEvent('firewatch:settings-updated', { detail: saved }));
      setSettingsMessage('Đã lưu cài đặt nhận diện.');
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Không lưu được cấu hình suy luận.');
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
        throw new Error(payload.error || 'Camera service không lưu được cấu hình nhận diện người.');
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

  const latestModelName = captureSummary.model;

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
              Camera service nhận diện lửa/khói, lưu capture và gửi sự kiện về backend.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCaptureReload(value => value + 1)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          Tải lại ảnh
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
          <div className="text-xs text-slate-500 font-bold mb-1">MÔ HÌNH ẢNH MỚI NHẤT</div>
          <div className="flex items-baseline justify-between">
            <span className="font-bold text-slate-900 text-sm truncate">
              {displayModelName(latestModelName)}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
              {systemStatus.camera === 'live' ? 'Co frame' : 'Chưa live'}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 bg-white">
          <div className="text-xs text-slate-500 font-bold mb-1">ẢNH TRONG CÁC NHÓM ĐÃ TẢI</div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-xl font-bold text-slate-900">{captureSummary.images}</span>
            <span className="text-[11px] text-slate-500">
              {captureSummary.groups} nhóm
            </span>
          </div>
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


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-4">
          <CameraPlayer
            cameraName="CAM-01 (Phòng Thủ Dầu Một)"
            detections={latestAlertDetections}
            isOnline={systemStatus.camera === 'live'}
            streamUrl={cameraStreamUrl}
          />

          <CaptureHistory reload={captureReload} onSummary={setCaptureSummary} />
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
                <div>Mô hình người: <span className="font-mono">{modelLabel(personDetection.modelName)}</span></div>
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


    </div>
  );
};
