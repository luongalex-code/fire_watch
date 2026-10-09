import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Camera, CheckCircle, Flame, Radio } from 'lucide-react';
import { useFireWatch } from '../hooks/useFireWatch';
import { AlertEvent } from '../types';
import { fireWatchService } from '../services';
import { EventTimeline } from '../components/alerts/EventTimeline';
import { getConditionLabel, getSeverityLabel, getStatusLabel } from '../utils/formatters';

export const AlertDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { alerts, acknowledgeAlert, operator } = useFireWatch();
  const [currentAlert, setCurrentAlert] = useState<AlertEvent | null>(null);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (eventId) {
      fireWatchService.getAlertById(eventId).then((found) => {
        if (mounted && found) setCurrentAlert(found);
      });
    }
    return () => {
      mounted = false;
    };
  }, [eventId, alerts]);

  if (!currentAlert) {
    return (
      <div className="p-8 text-center bg-white rounded-lg border border-slate-200">
        <h3 className="text-base font-bold text-slate-800 mb-2">Dang tai chi tiet cảnh báo...</h3>
        <Link to="/alerts" className="text-xs text-blue-600 hover:underline">
          Quay lai danh sach cảnh báo
        </Link>
      </div>
    );
  }

  const sev = getSeverityLabel(currentAlert.severity);
  const st = getStatusLabel(currentAlert.status);
  const condition = getConditionLabel(currentAlert.conditionStatus);

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    try {
      await acknowledgeAlert(currentAlert.id);
      const refreshed = await fireWatchService.getAlertById(currentAlert.id);
      if (refreshed) setCurrentAlert(refreshed);
    } finally {
      setIsAcknowledging(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/alerts')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lai danh sach cảnh báo</span>
        </button>
        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
          {currentAlert.code}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 text-white p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${sev.bg} ${sev.textCol} ${sev.border}`}>
                {sev.text}
              </span>
              <span className="text-xs text-slate-400 font-mono">Phat hien luc: {currentAlert.timestamp}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-400" />
              {currentAlert.title}
            </h1>
            <div className="text-xs text-slate-300 mt-1 flex items-center gap-2 font-mono">
              <span>Khu vực: <strong>{currentAlert.areaName}</strong></span>
              <span>-</span>
              <span>Nguồn: {currentAlert.sourceDescription}</span>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-1 rounded text-[11px] font-mono font-bold ${st.bg} ${st.textCol}`}>{st.text}</span>
              <span className={`px-2 py-1 rounded text-[11px] font-mono font-bold ${condition.bg} ${condition.textCol}`}>{condition.text}</span>
            </div>
            {currentAlert.status === 'new' ? (
              <button
                onClick={handleAcknowledge}
                disabled={isAcknowledging}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-60"
              >
                <CheckCircle className="w-4 h-4" />
                {isAcknowledging ? 'Đãng ghi nhận...' : 'Đã tiếp nhận'}
              </button>
            ) : (
              <span className="text-[10px] font-mono text-slate-400">
                {currentAlert.operatorName || operator.name} - {currentAlert.acknowledgedAt}
              </span>
            )}
          </div>
        </div>

        <div className="bg-amber-50 border-b border-amber-200 p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-bold uppercase tracking-wide text-amber-900 block mb-0.5">Luu y van hanh</strong>
            Nhấn "Đã tiếp nhận" chỉ ghi nhận người vận hành và thời điểm tiếp nhận. Thao tác này không gửi lệnh tắt bơm, còi hay đèn. Điều kiện cảnh báo chỉ hết khi backend ghi nhận từ cảm biến hoặc camera AI.
          </div>
        </div>

        <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 border-b border-slate-200">
          <div className="lg:col-span-7 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900">
              <span className="flex items-center gap-1.5"><Camera className="w-4 h-4 text-slate-700" />Camera AI / bang chung nhận diện</span>
              <span className="font-mono text-[11px] text-slate-500">{currentAlert.detections.length} detection</span>
            </div>
            <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-700 shadow-inner flex items-center justify-center text-white">
              {currentAlert.detections.length > 0 ? (
                <div className="space-y-2 text-center font-mono text-xs">
                  {currentAlert.detections.slice(0, 4).map((detection) => (
                    <div key={detection.id}>
                      <span className="text-red-300 font-bold uppercase">{detection.class}</span>{' '}
                      <span>{(detection.confidence * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400">Chua có frame AI gan voi cảnh báo nay.</div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900">
              <span className="flex items-center gap-1.5"><Radio className="w-4 h-4 text-emerald-600" />Giá trị cảm biến</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">ESP32-S3</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Metric label="Flame ADC" value={currentAlert.sensorSnapshot.flameAdc ?? '-'} tone="red" />
              <Metric label="Nhiệt độ" value={currentAlert.sensorSnapshot.temp !== null ? `${currentAlert.sensorSnapshot.temp} C` : '-'} tone="slate" />
              <Metric label="Độ ẩm" value={currentAlert.sensorSnapshot.humidity !== null ? `${currentAlert.sensorSnapshot.humidity} %` : '-'} tone="slate" />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              {currentAlert.conditionStatus === 'cleared'
                ? `Điều kiện cảnh báo da het luc: ${currentAlert.conditionClearedAt}`
                : 'Điều kiện cảnh báo van active hoặc chưa đủ du lieu xác nhận da het.'}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 border-b border-slate-200">
          <EventTimeline steps={currentAlert.timeline} />
        </div>
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: React.ReactNode; tone: 'red' | 'amber' | 'slate' }> = ({ label, value, tone }) => {
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
