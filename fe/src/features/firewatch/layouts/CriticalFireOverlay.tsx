import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Camera,
  CheckCircle2,
  ExternalLink,
  Flame,
  Gauge,
  Radio,
  ShieldAlert,
  Siren,
} from 'lucide-react';
import { useFireWatch } from '../hooks/useFireWatch';
import { CameraPlayer } from '../components/camera/CameraPlayer';

const cameraStreamUrl = import.meta.env.VITE_CAMERA_STREAM_URL || 'http://127.0.0.1:8090/stream';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

const PERSON_MAX_AGE_SECONDS = Number(import.meta.env.VITE_PERSON_TTS_MAX_AGE_SECONDS || 3);
const TTS_REPEAT_DELAY_SECONDS = Number(import.meta.env.VITE_TTS_REPEAT_DELAY_SECONDS || 2);
const TTS_LENGTH_SCALE = Number(import.meta.env.VITE_PIPER_TTS_LENGTH_SCALE || 0.95);
const TTS_SENTENCE_SILENCE = Number(import.meta.env.VITE_PIPER_TTS_SENTENCE_SILENCE || 0.35);

const formatPersonTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

type TtsSession = {
  alertId: string;
  areaName: string;
  fireWasActive: boolean;
};

type TtsMessageType = 'fire-initial' | 'fire-repeat' | 'person-detected' | 'person-repeat';

type TtsMessage = {
  type: TtsMessageType;
  text: string;
  alertId: string | null;
};

type TtsSnapshot = {
  alertId: string | null;
  areaName: string;
  fireActive: boolean;
  personDetected: boolean;
  personCount: number;
};

export const CriticalFireOverlay: React.FC = () => {
  const {
    fullScreenAlert,
    activeCriticalAlert,
    latestReading,
    systemStatus,
    acknowledgeAlert,
    dismissFullScreenAlert,
  } = useFireWatch();

  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [ttsSettings, setTtsSettings] = useState<any>(null);

  useEffect(() => {
    import('../services').then(({ fireWatchService }) => {
      fireWatchService.getSettings().then(setTtsSettings).catch(console.error);
    });
  }, []);

  const [ttsError, setTtsError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsRequestTokenRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const ttsTimerRef = useRef<number | null>(null);
  const ttsSessionRef = useRef<TtsSession | null>(null);
  const ttsQueueRef = useRef<TtsMessage[]>([]);
  const ttsPlayingRef = useRef(false);
  const scheduleRepeatRef = useRef<() => void>(() => undefined);
  const ttsSnapshotRef = useRef<TtsSnapshot>({
    alertId: null,
    areaName: '',
    fireActive: false,
    personDetected: false,
    personCount: 0,
  });
  const clearTtsTimer = useCallback(() => {
    if (ttsTimerRef.current !== null) {
      window.clearTimeout(ttsTimerRef.current);
      ttsTimerRef.current = null;
    }
  }, []);

  const stopCurrentAudio = useCallback(() => {
    ttsRequestTokenRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  const stopTtsCompletely = useCallback(() => {
    clearTtsTimer();
    stopCurrentAudio();
    ttsQueueRef.current = [];
    ttsPlayingRef.current = false;
    ttsSessionRef.current = null;
  }, [clearTtsTimer, stopCurrentAudio]);

  const playPiperTts = useCallback(
    async (text: string, stillRelevant: () => boolean) => {
      if (!stillRelevant()) return false;
      const requestToken = ttsRequestTokenRef.current;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      let audioUrl: string | null = null;
      let audio: HTMLAudioElement | null = null;
      try {
        const response = await fetch(`${apiBaseUrl}/api/tts/piper`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
          body: JSON.stringify({
            text,
            voice: 'vi_VN-vais1000-medium',
            length_scale: TTS_LENGTH_SCALE,
            sentence_silence: TTS_SENTENCE_SILENCE,
          }),
        });

        if (!response.ok) {
          throw new Error(`Piper TTS ${response.status}`);
        }

        const blob = await response.blob();
        if (ttsRequestTokenRef.current !== requestToken || !stillRelevant()) {
          return false;
        }

        audioUrl = URL.createObjectURL(blob);
        const playingAudio = new Audio(audioUrl);
        audio = playingAudio;
        playingAudio.volume = 1;
        audioRef.current = playingAudio;
        await new Promise<void>((resolve, reject) => {
          playingAudio.onended = () => resolve();
          playingAudio.onpause = () => resolve();
          playingAudio.onerror = () => reject(new Error('Không phát được âm thanh Piper TTS.'));
          void playingAudio.play().catch(reject);
        });
        return true;
      } finally {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        if (audioRef.current === audio) audioRef.current = null;
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    []
  );

  const getTtsSnapshot = useCallback((): TtsSnapshot => {
    const bannerAlert =
      activeCriticalAlert &&
      activeCriticalAlert.status === 'new' &&
      activeCriticalAlert.isActive
        ? activeCriticalAlert
        : null;
    const person = systemStatus.personDetection;
    const personUpdatedAtMs = person?.updatedAt ? new Date(person.updatedAt).getTime() : 0;
    const personFresh =
      !personUpdatedAtMs ||
      Date.now() - personUpdatedAtMs <= PERSON_MAX_AGE_SECONDS * 1000;
    const personCount = Math.max(0, Number(person?.personCount || 0));
    const personDetected = Boolean(
      person?.enabled &&
        person.status === 'online' &&
        personFresh &&
        personCount > 0
    );
    const session = ttsSessionRef.current;

    return {
      alertId: bannerAlert?.id || session?.alertId || null,
      areaName: bannerAlert?.areaName || session?.areaName || 'khu vực giám sát',
      fireActive: Boolean(bannerAlert),
      personDetected,
      personCount,
    };
  }, [activeCriticalAlert, systemStatus.personDetection]);

  const isTtsMessageRelevant = useCallback((message: TtsMessage) => {
    const snapshot = getTtsSnapshot();
    if (
      message.type === 'fire-initial' ||
      message.type === 'fire-repeat' ||
      message.type === 'person-detected' ||
      message.type === 'person-repeat'
    ) {
      return snapshot.fireActive && message.alertId === snapshot.alertId;
    }
    return false;
  }, [getTtsSnapshot]);

  const sanitizeTtsQueue = useCallback(() => {
    ttsQueueRef.current = ttsQueueRef.current.filter(isTtsMessageRelevant);
  }, [isTtsMessageRelevant]);

  const playNextTts = useCallback(async () => {
    if (ttsPlayingRef.current) return;
    sanitizeTtsQueue();

    const message = ttsQueueRef.current.shift();
    if (!message) return;

    ttsPlayingRef.current = true;
    setTtsError('');

    try {
      await playPiperTts(message.text, () => isTtsMessageRelevant(message));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setTtsError(error instanceof Error ? error.message : 'Lỗi phát âm thanh cảnh báo.');
    } finally {
      ttsPlayingRef.current = false;
      sanitizeTtsQueue();
      if (ttsQueueRef.current.length > 0) {
        void playNextTts();
      } else {
        scheduleRepeatRef.current();
      }
    }
  }, [isTtsMessageRelevant, playPiperTts, sanitizeTtsQueue]);

  const enqueueTts = useCallback((message: TtsMessage, allowDuplicate = false) => {
    if (!allowDuplicate) {
      const alreadyQueued = ttsQueueRef.current.some((item) => item.type === message.type && item.alertId === message.alertId);
      if (alreadyQueued) return;
    }

    ttsQueueRef.current.push(message);
    void playNextTts();
  }, [playNextTts]);

  const renderTtsTemplate = useCallback((template: string, session: TtsSession, snapshot: TtsSnapshot) => {
    let result = template;
    result = result.replace(/{areaName}/g, session.areaName);
    result = result.replace(/{personCount}/g, snapshot.personCount.toString());
    return result;
  }, []);

  const scheduleTtsRepeat = useCallback(() => {
    clearTtsTimer();
    const delayMs = ttsSettings?.ttsRepeatDelayMs ?? (Math.max(0.1, TTS_REPEAT_DELAY_SECONDS) * 1000);
    ttsTimerRef.current = window.setTimeout(() => {
      const snapshot = getTtsSnapshot();
      const session = ttsSessionRef.current;
      if (!session || !snapshot.fireActive) {
        stopTtsCompletely();
        return;
      }

      if (ttsSettings?.ttsFireRepeatEnabled ?? true) {
        enqueueTts({
          type: 'fire-repeat',
          text: renderTtsTemplate(ttsSettings?.ttsFireRepeatMessage || `Cảnh báo cháy tại {areaName}.`, session, snapshot),
          alertId: session.alertId,
        });
      }

      if (snapshot.personDetected) {
        if (ttsSettings?.ttsPersonRepeatEnabled ?? true) {
          enqueueTts({
            type: 'person-repeat',
            text: renderTtsTemplate(ttsSettings?.ttsPersonRepeatMessage || `Phát hiện {personCount} người tại {areaName}.`, session, snapshot),
            alertId: session.alertId,
          });
        }
      }
    }, delayMs);
  }, [clearTtsTimer, enqueueTts, getTtsSnapshot, stopTtsCompletely, ttsSettings, renderTtsTemplate]);

  scheduleRepeatRef.current = scheduleTtsRepeat;

  useEffect(() => {
    const snapshot = getTtsSnapshot();
    const previous = ttsSnapshotRef.current;
    const previousSession = ttsSessionRef.current;

    ttsSnapshotRef.current = snapshot;

    if (!snapshot.fireActive) {
      stopTtsCompletely();
      return;
    }

    if (snapshot.fireActive) {
      if (!previousSession || previousSession.alertId !== snapshot.alertId || !previous.fireActive) {
        stopTtsCompletely();
        ttsSessionRef.current = {
          alertId: snapshot.alertId || `fire-${Date.now()}`,
          areaName: snapshot.areaName,
          fireWasActive: true,
        };
        const session = ttsSessionRef.current;
        if (ttsSettings?.ttsInitialEnabled ?? true) {
          const rawMessage = ttsSettings?.ttsInitialMessage || `Chú ý, chú ý. Cảnh báo cháy tại {areaName}.`;
          const fireMessage = renderTtsTemplate(rawMessage, session, snapshot);
          const repeatCount = ttsSettings?.ttsInitialRepeatCount ?? 2;
          const fullMessage = Array(repeatCount).fill(fireMessage).join(' ');
          enqueueTts({ type: 'fire-initial', text: fullMessage, alertId: session.alertId }, true);
        }
        return;
      }

      previousSession.areaName = snapshot.areaName;
      previousSession.fireWasActive = true;
    }

    if (snapshot.fireActive && !previous.personDetected && snapshot.personDetected && ttsSessionRef.current) {
      if (ttsSettings?.ttsPersonDetectedEnabled ?? true) {
        enqueueTts({
          type: 'person-detected',
          text: renderTtsTemplate(ttsSettings?.ttsPersonDetectedMessage || `Phát hiện {personCount} người tại {areaName}.`, ttsSessionRef.current, snapshot),
          alertId: ttsSessionRef.current.alertId,
        });
      }
    }


  }, [enqueueTts, getTtsSnapshot, sanitizeTtsQueue, stopTtsCompletely, ttsSettings, renderTtsTemplate]);

  useEffect(() => {
    return () => {
      stopTtsCompletely();
    };
  }, [stopTtsCompletely]);

  const bestDetection = useMemo(() => {
    return fullScreenAlert?.detections.reduce(
      (best, detection) => (detection.confidence > best.confidence ? detection : best),
      fullScreenAlert.detections[0]
    );
  }, [fullScreenAlert]);

  const handleAcknowledge = async () => {
    if (!fullScreenAlert) return;
    const alertId = fullScreenAlert.id;
    setIsAcknowledging(true);
    try {
      await acknowledgeAlert(alertId);
      dismissFullScreenAlert(alertId);
    } finally {
      setIsAcknowledging(false);
    }
  };

  const personDetection = systemStatus.personDetection;
  const personUpdatedAt = personDetection?.updatedAt;
  const personStatusText = personDetection?.status === 'online'
    ? `Camera đang phát hiện ${personDetection.personCount} người`
    : 'Dữ liệu nhận diện người không khả dụng';

  if (!fullScreenAlert) {
    return null;
  }

  const hasFreshEsp32Reading = systemStatus.esp32 === 'connected' && Boolean(latestReading) && !latestReading?.isStale;
  const alertSourceLabel =
    fullScreenAlert.source === 'dual'
      ? 'Backend xác nhận điều kiện kép'
      : fullScreenAlert.source === 'sensor'
        ? 'Cảm biến ESP32 phát hiện lửa'
        : fullScreenAlert.source === 'ai'
          ? 'Camera AI phát hiện lửa/khói'
          : 'Cảnh báo hệ thống';
  const headline =
    fullScreenAlert.source === 'dual'
      ? `CẢNH BÁO CHÁY — ${fullScreenAlert.areaName}`
      : `CẢNH BÁO ${fullScreenAlert.source === 'sensor' ? 'CẢM BIẾN' : fullScreenAlert.source === 'ai' ? 'AI' : 'HỆ THỐNG'} — ${fullScreenAlert.areaName}`;
  const formatMetric = (value: number | null | undefined, suffix = '') => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Chưa có dữ liệu';
    return `${Number(value).toFixed(suffix ? 1 : 0)}${suffix}`;
  };
  const flameAdc = hasFreshEsp32Reading ? latestReading?.flameAdc : null;

  const temperature = hasFreshEsp32Reading ? latestReading?.temperatureC : null;
  const humidity = hasFreshEsp32Reading ? latestReading?.humidityPercent : null;
  const pumpActive = hasFreshEsp32Reading && latestReading?.pumpRelayState === true;
  const outputKnown = hasFreshEsp32Reading && latestReading?.pumpRelayState !== null && latestReading?.pumpRelayState !== undefined;
  const buzzerLedValue =
    hasFreshEsp32Reading
      ? [
          latestReading?.buzzerState === true ? 'Còi ON' : latestReading?.buzzerState === false ? 'Còi OFF' : '',
          latestReading?.ledState === true ? 'LED ON' : latestReading?.ledState === false ? 'LED OFF' : '',
        ].filter(Boolean).join(' / ') || 'Chưa có dữ liệu'
      : 'Chưa có dữ liệu';
  const aiConfidence = bestDetection?.confidence ?? fullScreenAlert.aiConfidence ?? null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/78 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center">
        <section className="w-full max-w-7xl bg-white rounded-lg shadow-2xl border border-red-300 overflow-hidden">
          <div className="bg-red-700 text-white px-4 sm:px-6 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-100">
                <Siren className="w-4 h-4 animate-pulse" />
                {alertSourceLabel}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black leading-tight mt-1">
                {headline}
              </h1>
              <p className="text-sm text-red-100 mt-1">
                {fullScreenAlert.timestamp} | Nguồn: {fullScreenAlert.sourceDescription}
              </p>
              <p className="text-xs text-red-100 mt-1">
                {personStatusText}
                {personUpdatedAt && ` | Cập nhật người: ${formatPersonTime(personUpdatedAt)}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/camera-ai"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
              >
                <Camera className="w-4 h-4" />
                Xem camera
              </Link>
            </div>
          </div>

          {ttsError && (
            <div className="border-b border-red-200 bg-amber-50 px-4 sm:px-6 py-2 text-xs font-semibold text-amber-900">
              Lỗi TTS: {ttsError}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.9fr)] gap-0">
            <div className="bg-slate-950 p-3 sm:p-4">
              <CameraPlayer
                cameraName={`CAM-01 (${fullScreenAlert.areaName})`}
                detections={fullScreenAlert.detections}
                isOnline={systemStatus.camera === 'live'}
                streamUrl={cameraStreamUrl}
                className="border-red-500/60"
              />
            </div>

            <aside className="p-4 sm:p-5 bg-slate-50 border-l border-slate-200 space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                  <ShieldAlert className="w-4 h-4" />
                  Sự kiện đang cần xử lý
                </div>
                <p className="text-sm text-red-900 mt-1 font-semibold">{fullScreenAlert.title}</p>
                <p className="text-xs text-red-800 mt-1">{fullScreenAlert.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Metric label="Flame ADC" value={formatMetric(flameAdc)} tone="red" />

                <Metric label="Nhiệt độ" value={formatMetric(temperature, ' C')} tone="slate" />
                <Metric label="Độ ẩm" value={formatMetric(humidity, ' %')} tone="slate" />
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
                  <Gauge className="w-4 h-4 text-slate-600" />
                  AI confidence
                </div>
                {aiConfidence !== null ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold uppercase text-red-700">
                      {bestDetection?.class || 'fire/smoke'}
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {(aiConfidence * 100).toFixed(1)}%
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Chưa có metadata confidence từ camera AI.</div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <StatusLine icon={<Radio className="w-4 h-4" />} label="ESP32" value={systemStatus.esp32} active={systemStatus.esp32 === 'connected'} />
                <StatusLine icon={<Camera className="w-4 h-4" />} label="Camera" value={systemStatus.camera} active={systemStatus.camera === 'live'} />
                <StatusLine icon={<Flame className="w-4 h-4" />} label="Relay bơm" value={outputKnown ? (pumpActive ? 'ON' : 'OFF') : 'Chưa có dữ liệu'} active={pumpActive} danger />
                <StatusLine icon={<Bell className="w-4 h-4" />} label="Còi/LED" value={buzzerLedValue} active={latestReading?.buzzerState === true || latestReading?.ledState === true} danger />
              </div>
            </aside>
          </div>

          <div className="px-4 sm:px-6 py-4 bg-white border-t border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-600 max-w-2xl">
              Tiếp nhận cảnh báo chỉ ghi nhận người vận hành và thời điểm xử lý. Lệnh này không tắt bơm, còi hoặc đèn cảnh báo.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/alerts/${fullScreenAlert.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                Xem chi tiết
                <ExternalLink className="w-4 h-4" />
              </Link>
              <Link
                to="/devices"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                Mở điều khiển thiết bị
              </Link>
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={isAcknowledging}
                className="inline-flex items-center gap-2 rounded-md bg-red-700 px-5 py-2 text-sm font-black text-white shadow-sm hover:bg-red-800"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isAcknowledging ? 'Đang ghi nhận...' : 'Đã tiếp nhận cảnh báo'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: React.ReactNode; tone: 'red' | 'amber' | 'slate' }> = ({
  label,
  value,
  tone,
}) => {
  const toneClass =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-800'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-slate-200 bg-white text-slate-800';

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-lg font-black font-mono">{value}</div>
    </div>
  );
};

const StatusLine: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
  danger?: boolean;
}> = ({ icon, label, value, active, danger = false }) => {
  const color = active ? (danger ? 'text-red-700 bg-red-50 border-red-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200') : 'text-slate-500 bg-white border-slate-200';
  return (
    <div className={`rounded-lg border p-3 flex items-center justify-between gap-2 ${color}`}>
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="text-xs font-bold truncate">{label}</span>
      </div>
      <span className="text-xs font-black uppercase">{value}</span>
    </div>
  );
};
