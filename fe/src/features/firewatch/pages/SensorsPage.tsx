import React, { useState, useEffect } from 'react';
import { useFireWatch } from '../hooks/useFireWatch';
import { SensorCards } from '../components/sensors/SensorCard';
import { TelemetryDualAxisChart } from '../components/charts/TelemetryDualAxisChart';
import { DataTable, Column } from '../components/common/DataTable';
import { fireWatchService } from '../services';
import { TelemetryHistoryPoint } from '../services/contracts';
import { exportToCsv } from '../utils/exportCsv';
import { Radio, Download, Filter, RefreshCw, Cpu, Activity, Clock } from 'lucide-react';

export const SensorsPage: React.FC = () => {
  const { currentAreaId, latestReading, systemStatus } = useFireWatch();
  const [historyData, setHistoryData] = useState<TelemetryHistoryPoint[]>([]);
  const [filterPeriod, setFilterPeriod] = useState<'15m' | '1h' | '24h'>('15m');
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
      width: '20%',
      render: (item) => (
        <span className="font-mono text-red-600 font-semibold">
          {item.temp !== null ? `${item.temp.toFixed(1)} °C` : 'Không có số đo'}
        </span>
      ),
    },
    {
      key: 'humidity',
      header: 'Độ ẩm DHT22 (GPIO3)',
      width: '20%',
      render: (item) => (
        <span className="font-mono text-slate-700 font-semibold">
          {item.humidity !== null ? `${item.humidity.toFixed(1)} %` : 'Không có số đo'}
        </span>
      ),
    },
    {
      key: 'flameAdc',
      header: 'Flame Sensor ADC (GPIO6)',
      width: '22%',
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
      header: 'MQ-2 Gas ADC (GPIO5)',
      width: '20%',
      render: (item) => (
        <span className="font-mono text-slate-800 font-semibold">
          {item.mq2Adc !== null ? `${item.mq2Adc.toLocaleString()} ADC` : 'Không có số đo'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Header */}
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
              Giao thuc 1-Wire & ADC1 ESP32-S3: DHT22 (GPIO3), Flame quang hoc (GPIO6), MQ-2 (GPIO5)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất CSV Telemetry</span>
          </button>
        </div>
      </div>

      {/* Real-time Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5">
          <SensorCards reading={latestReading} isStale={isOffline} />
        </div>

        {/* Detailed Sensor Specification & GPIO Wiring */}
        <div className="lg:col-span-7 bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-slate-700" />
                Thông số Kỹ thuật Cảm biến & Ánh xạ Phần cứng
              </h3>
              <span className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Chu ky lay mau: 100ms
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900 mb-1">Cảm biến Lua Flame</div>
                <div className="text-[11px] font-mono text-slate-600 space-y-0.5">
                  <div>Kenh: <strong>ADC1_CH5 (GPIO6)</strong></div>
                  <div>Ngưỡng bao chay: <strong>&lt; 2,500 ADC</strong></div>
                  <div>Chu ky xac thuc: <strong>3 lan lien tiep</strong></div>
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900 mb-1">Cảm biến Khoi MQ-2</div>
                <div className="text-[11px] font-mono text-slate-600 space-y-0.5">
                  <div>Kenh: <strong>ADC1_CH4 (GPIO5)</strong></div>
                  <div>Thang do: <strong>0 - 4095 ADC Tho</strong></div>
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900 mb-1">Nhiệt ẩm DHT22</div>
                <div className="text-[11px] font-mono text-slate-600 space-y-0.5">
                  <div>Giao thuc: <strong>1-Wire Digital (GPIO3)</strong></div>
                  <div>Chu ky doc: <strong>2,000ms</strong></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            <strong>Ghi chu:</strong> MQ-2 chi luu ADC thô do ESP32 gửi len. Hệ thống không quy đổi thành nồng độ khí.
          </div>
        </div>
      </div>

      {/* Dual Axis Charts */}
      <TelemetryDualAxisChart data={historyData} />

      {/* Historical Telemetry Table */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-slate-700" />
            Bảng Lịch Sử Độ Lượng Chi Tiết (Audited Telemetry Log)
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            Hien thi {historyData.length} bản ghi gan nhat
          </span>
        </div>

        <DataTable
          columns={tableColumns}
          data={historyData}
          keyExtractor={(item) => item.time}
          emptyMessage="Chưa có dữ liệu do luong"
        />
      </div>
    </div>
  );
};

