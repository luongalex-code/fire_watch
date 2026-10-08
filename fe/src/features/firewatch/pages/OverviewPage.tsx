import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Clock, ExternalLink, Flame, Radio, ShieldAlert, Video } from 'lucide-react';
import { useFireWatch } from '../hooks/useFireWatch';
import { CameraPlayer } from '../components/camera/CameraPlayer';
import { SensorCards } from '../components/sensors/SensorCard';
import { DeviceControlWidget } from '../components/devices/DeviceControl';
import { TelemetryDualAxisChart } from '../components/charts/TelemetryDualAxisChart';
import { fireWatchService } from '../services';
import { TelemetryHistoryPoint } from '../services/contracts';
import { getSeverityLabel } from '../utils/formatters';

export const OverviewPage: React.FC = () => {
  const {
    currentAreaId,
    areas,
    devices,
    latestReading,
    alerts,
    unacknowledgedCount,
    systemStatus,
  } = useFireWatch();
  const cameraStreamUrl = import.meta.env.VITE_CAMERA_STREAM_URL || 'http://127.0.0.1:8090/stream';
  const [historyData, setHistoryData] = useState<TelemetryHistoryPoint[]>([]);
  const [historyError, setHistoryError] = useState('');
  const historyRangeMinutes = 24 * 60;

  const currentArea = areas.find((area) => area.id === currentAreaId) || areas[0] || null;

  const loadTelemetryHistory = useCallback(async () => {
    setHistoryError('');
    try {
      const data = await fireWatchService.getTelemetryHistory(currentAreaId, historyRangeMinutes);
      setHistoryData(data);
    } catch (error) {
      setHistoryData([]);
      setHistoryError(error instanceof Error ? error.message : 'Không tải được lich su telemetry');
    }
  }, [currentAreaId, historyRangeMinutes]);

  useEffect(() => {
    void loadTelemetryHistory();
    const interval = window.setInterval(() => void loadTelemetryHistory(), 15000);
    return () => window.clearInterval(interval);
  }, [loadTelemetryHistory]);

  const esp32Devices = devices.filter((device) => device.type === 'mcu_esp32');
  const cameraDevices = devices.filter((device) => device.type === 'camera_rtsp');
  const onlineEsp32Count = esp32Devices.filter((device) => device.isOnline).length;
  const liveCameraCount = systemStatus.camera === 'live' ? 1 : 0;

  const activeFireAlert = alerts.find(
    (alert) =>
      alert.areaId === currentAreaId &&
      alert.severity === 'critical' &&
      alert.isActive
  );

  const areaStatus = useMemo(() => {
    if (activeFireAlert) {
      return {
        text: 'Cảnh báo cháy đang active',
        className: 'bg-red-600 text-white animate-pulse',
      };
    }
    if (!latestReading || latestReading.isStale) {
      return {
        text: 'Chưa có dữ liệu mới',
        className: 'bg-slate-500 text-white',
      };
    }
    return {
      text: 'Chưa có điều kiện cảnh báo',
      className: 'bg-emerald-600 text-white',
    };
  }, [activeFireAlert, latestReading]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider">Khu vực giám sát</span>
            <span className="text-[11px] font-mono text-slate-400">
              {latestReading?.timestamp || 'Chưa có dữ liệu'}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 truncate">
            {currentArea?.name || 'Chưa có dữ liệu'}
          </h2>
          <div className="flex items-center justify-between mt-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${areaStatus.className}`}>
              <Flame className="w-3.5 h-3.5" />
              {areaStatus.text}
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1.5">
            Ma khu vực: {currentArea?.code || currentArea?.id || 'Chưa có dữ liệu'}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1 text-red-600">
              <Clock className="w-3.5 h-3.5" /> Cho tiep nhan
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-red-600">
              {String(unacknowledgedCount).padStart(2, '0')}
            </span>
            <span className="text-xs text-slate-500">cảnh báo chua tiep nhan</span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-slate-700" /> ESP32-S3
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                systemStatus.esp32 === 'connected'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {systemStatus.esp32 === 'connected' ? 'Ket noi' : 'Mất kết nối'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {onlineEsp32Count} / {esp32Devices.length}
            </span>
            <span className="text-xs text-slate-500">thiết bị online</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-2">
            Cảm biến lửa, DHT22, MQ-2, relay bom/coi/LED
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1">
              <Video className="w-3.5 h-3.5 text-slate-700" /> Camera AI
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                systemStatus.camera === 'live'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {systemStatus.camera === 'live' ? 'Co frame mới' : 'Chưa live'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {liveCameraCount} / {cameraDevices.length || 1}
            </span>
            <span className="text-xs text-slate-500">camera có frame</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-2">
            {typeof systemStatus.cameraFrameAgeSeconds === 'number'
              ? `Frame mới ${systemStatus.cameraFrameAgeSeconds.toFixed(1)} giay truoc`
              : 'Chưa có dữ liệu frame'}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
        <div className="flex items-start gap-2 text-xs text-slate-700">
          <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div>
            <strong>Luồng bật bơm:</strong> cảm biến xác nhận lửa + AI xác nhận lửa/khói trong cùng khu vực
            trong điều kiện backend đang theo dõi. Khi đủ điều kiện kép, backend gửi MQTT <code>pump:on</code>.
            AI phát hiện đơn lẻ hoặc cảm biến phát hiện đơn lẻ chưa đủ để xem là điều kiện bật bơm từ backend.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <CameraPlayer
            cameraName="CAM-01 (Phòng Thủ Dầu Một)"
            detections={alerts[0]?.detections || []}
            isOnline={systemStatus.camera === 'live'}
            streamUrl={cameraStreamUrl}
          />
        </div>

        <div className="lg:col-span-5 space-y-4">
          <SensorCards reading={latestReading} isStale={systemStatus.esp32 === 'disconnected'} />
          <DeviceControlWidget showLinkToDetails={true} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          {historyError ? (
            <div className="bg-white rounded-lg border border-red-200 p-4 text-sm text-red-700">
              Không tải được lich su telemetry: {historyError}
            </div>
          ) : (
            <TelemetryDualAxisChart data={historyData} className="min-h-[640px]" />
          )}
        </div>

        <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-slate-700" />
              5 sự kiện gần nhất
            </h3>
            <Link to="/alerts" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              Tất cả <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {alerts.length === 0 ? (
            <div className="rounded border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              Chưa có dữ liệu cảnh báo
            </div>
          ) : (
            <div className="space-y-2.5">
              {alerts.slice(0, 5).map((event) => {
                const severity = getSeverityLabel(event.severity);
                return (
                  <Link
                    key={event.id}
                    to={`/alerts/${event.id}`}
                    className="block p-2.5 rounded-lg border border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-mono font-bold text-slate-900">{event.code}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border ${severity.bg} ${severity.textCol} ${severity.border}`}>
                        {severity.text}
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 font-semibold line-clamp-1">{event.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 flex justify-between gap-2">
                      <span>{event.areaName}</span>
                      <span className="font-mono text-slate-400">{event.operatorName || 'Hệ thống'}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
