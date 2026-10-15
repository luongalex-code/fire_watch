import React, { useState, useEffect } from 'react';
import { useFireWatch } from '../hooks/useFireWatch';
import { SensorCards } from '../components/sensors/SensorCard';
import { TelemetryDualAxisChart } from '../components/charts/TelemetryDualAxisChart';
import { DataTable, Column } from '../components/common/DataTable';
import { fireWatchService } from '../services';
import { TelemetryHistoryPoint } from '../services/contracts';
import { exportToCsv } from '../utils/exportCsv';
import { Radio, Download, Cpu, Activity } from 'lucide-react';

export const SensorsPage: React.FC = () => {
  const { currentAreaId, latestReading, systemStatus } = useFireWatch();
  const [historyData, setHistoryData] = useState<TelemetryHistoryPoint[]>([]);
  const [mq2SmokeOnThresholdAdc, setMq2SmokeOnThresholdAdc] = useState(1200);
  const [mq2SmokeOffThresholdAdc, setMq2SmokeOffThresholdAdc] = useState(900);
  const [filterPeriod] = useState<'15m' | '1h' | '24h'>('15m');
  const isOffline = systemStatus.esp32 === 'disconnected';

  useEffect(() => {
    let mounted = true;
    fireWatchService.getTelemetryHistory(currentAreaId, 15).then((data) => {
      if (mounted) setHistoryData(data);
    });
    return () => {
      mounted = false;
    };
  }, [currentAreaId, filterPeriod]);

  useEffect(() => {
    let mounted = true;
    fireWatchService.getSettings().then((settings) => {
      if (!mounted) return;
      setMq2SmokeOnThresholdAdc(settings.mq2SmokeOnThresholdAdc ?? 1200);
      setMq2SmokeOffThresholdAdc(settings.mq2SmokeOffThresholdAdc ?? 900);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleExportCsv = () => {
    const headers = ['Thời gian', 'Nhiệt độ (°C)', 'Độ ẩm (%RH)', 'Flame ADC (GPIO6)', 'MQ-2 ADC (GPIO5)'];
    const rows = historyData.map((d) => [
      d.time,
      d.temp ?? '',
      d.humidity ?? '',
      d.flameAdc ?? '',
      d.mq2Adc ?? '',
    ]);
    exportToCsv(`Telemetry_ESP32_${currentAreaId}_${Date.now()}.csv`, headers, rows);
  };

  const tableColumns: Column<TelemetryHistoryPoint>[] = [
    {
      key: 'time',
      header: 'Thời điểm (UTC+7)',
      width: '18%',
      render: (item) => <span className="font-mono font-bold text-slate-900">{item.time}</span>,
    },
    {
      key: 'temp',
      header: 'Nhiệt độ DHT22 (GPIO3)',
      width: '17%',
      render: (item) => (
        <span className="font-mono text-red-600 font-semibold">
          {item.temp !== null ? `${item.temp.toFixed(1)} °C` : 'Không có số đo'}
        </span>
      ),
    },
    {
      key: 'humidity',
      header: 'Độ ẩm DHT22 (GPIO3)',
      width: '17%',
      render: (item) => (
        <span className="font-mono text-slate-700 font-semibold">
          {item.humidity !== null ? `${item.humidity.toFixed(1)} %` : 'Không có số đo'}
        </span>
      ),
    },
    {
      key: 'flameAdc',
      header: 'Flame ADC (GPIO6)',
      width: '20%',
      render: (item) => (
        <span
          className={`font-mono font-bold ${
            item.flameAdc !== null && item.flameAdc < 2500
              ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded'
              : 'text-slate-800'
          }`}
        >
          {item.flameAdc !== null ? `${item.flameAdc.toLocaleString()} ADC` : 'Không có số đo'}
        </span>
      ),
    },
    {
      key: 'mq2Adc',
      header: 'MQ-2 ADC (GPIO5)',
      width: '20%',
      render: (item) => (
        <span
          className={`font-mono font-bold ${
            item.mq2SmokeDetected
              ? 'text-orange-700 bg-orange-50 px-2 py-0.5 rounded'
              : 'text-slate-800'
          }`}
        >
          {item.mq2Adc !== null ? `${item.mq2Adc.toLocaleString()} ADC` : 'Không có số đo'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white">
            <Radio className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              GIÁM SÁT CẢM BIẾN MÔI TRƯỜNG & TELEMETRY HIỆN TRƯỜNG
            </h2>
            <p className="text-xs text-slate-500">
              ESP32-S3: DHT22 GPIO3, Flame GPIO6, MQ-2 khói/khí ga GPIO5.
            </p>
          </div>
        </div>

        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Xuất CSV Telemetry</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5">
          <SensorCards reading={latestReading} isStale={isOffline} />
        </div>

        <div className="lg:col-span-7 bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-slate-700" />
                Thông số kỹ thuật cảm biến & ánh xạ phần cứng
              </h3>
              <span className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Chu kỳ lấy mẫu: 100ms
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900 mb-1">Cảm biến lửa Flame</div>
                <div className="text-[11px] font-mono text-slate-600 space-y-0.5">
                  <div>Kênh: <strong>ADC1_CH5 (GPIO6)</strong></div>
                  <div>Ngưỡng báo cháy: <strong>&lt; 2,500 ADC</strong></div>
                  <div>Chu kỳ xác thực: <strong>3 lần liên tiếp</strong></div>
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900 mb-1">Nhiệt ẩm DHT22</div>
                <div className="text-[11px] font-mono text-slate-600 space-y-0.5">
                  <div>Giao thức: <strong>1-Wire Digital (GPIO3)</strong></div>
                  <div>Chu kỳ đọc: <strong>2,000ms</strong></div>
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900 mb-1">Cảm biến khói/khí ga MQ-2</div>
                <div className="text-[11px] font-mono text-slate-600 space-y-0.5">
                  <div>Kênh AO: <strong>ADC1_CH4 (GPIO5)</strong></div>
                  <div>Số đo hiển thị: <strong>0 - 4095 ADC thô</strong></div>
                  <div>Ngưỡng bật quạt: <strong>&gt;= {mq2SmokeOnThresholdAdc.toLocaleString()} ADC</strong></div>
                  <div>Ngưỡng tắt quạt: <strong>&lt;= {mq2SmokeOffThresholdAdc.toLocaleString()} ADC</strong></div>
                  <div>Relay quạt: <strong>GPIO15</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TelemetryDualAxisChart data={historyData} mq2SmokeOnThresholdAdc={mq2SmokeOnThresholdAdc} />

      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-slate-700" />
            Bảng lịch sử đo lường chi tiết
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            Hiển thị {historyData.length} bản ghi gần nhất
          </span>
        </div>

        <DataTable
          columns={tableColumns}
          data={historyData}
          keyExtractor={(item) => item.time}
          emptyMessage="Chưa có dữ liệu đo lường"
        />
      </div>
    </div>
  );
};
