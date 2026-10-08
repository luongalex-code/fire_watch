import React, { useMemo } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useFireWatch } from '../hooks/useFireWatch';
import { DataTable, Column } from '../components/common/DataTable';
import { AlertEvent } from '../types';
import { exportToCsv } from '../utils/exportCsv';

const statusLabel = (status: AlertEvent['status']) => {
  if (status === 'acknowledged') return 'Đã tiếp nhận';
  if (status === 'new') return 'Mới';
  if (status === 'resolved') return 'Đã kết thúc';
  return status;
};

const conditionLabel = (status?: AlertEvent['conditionStatus']) => {
  if (status === 'active') return 'Dang con điều kiện';
  if (status === 'cleared') return 'Điều kiện đã hết';
  return 'Chưa rõ';
};

const sourceLabel = (source: AlertEvent['source']) => {
  if (source === 'dual') return 'Backend xác nhận kép';
  if (source === 'ai') return 'Camera AI';
  if (source === 'sensor') return 'Cảm biến ESP32';
  return 'Loi thiết bị';
};

export const ReportsPage: React.FC = () => {
  const { alerts, currentAreaId } = useFireWatch();

  const stats = useMemo(() => {
    return {
      total: alerts.length,
      newCount: alerts.filter((alert) => alert.status === 'new').length,
      acknowledgedCount: alerts.filter((alert) => alert.status === 'acknowledged').length,
      activeConditionCount: alerts.filter((alert) => alert.isActive).length,
    };
  }, [alerts]);

  const handleExportCsv = () => {
    const headers = [
      'Mã cảnh báo',
      'Thời điểm',
      'Khu vực',
      'Nguồn',
      'Mức độ',
      'Trạng thái tiep nhan',
      'Trạng thái điều kiện',
      'Người tiếp nhận',
    ];
    const rows = alerts.map((alert) => [
      alert.code,
      alert.timestamp,
      alert.areaName,
      sourceLabel(alert.source),
      alert.severity,
      statusLabel(alert.status),
      conditionLabel(alert.conditionStatus),
      alert.operatorName || '',
    ]);
    exportToCsv(`firewatch_alerts_${currentAreaId}_${Date.now()}.csv`, headers, rows);
  };

  const columns: Column<AlertEvent>[] = [
    {
      key: 'code',
      header: 'Mã cảnh báo',
      width: '14%',
      render: (alert) => <span className="font-mono font-bold text-red-700">{alert.code}</span>,
    },
    {
      key: 'timestamp',
      header: 'Thời điểm',
      width: '18%',
      render: (alert) => <span className="font-mono text-[11px] text-slate-800">{alert.timestamp}</span>,
    },
    {
      key: 'areaName',
      header: 'Khu vực',
      width: '18%',
      render: (alert) => <span className="font-semibold text-slate-900">{alert.areaName}</span>,
    },
    {
      key: 'source',
      header: 'Nguồn',
      width: '16%',
      render: (alert) => (
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
          {sourceLabel(alert.source)}
        </span>
      ),
    },
    {
      key: 'severity',
      header: 'Mức độ',
      width: '10%',
      align: 'center',
      render: (alert) => (
        <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
          {alert.severity}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Tiếp nhận',
      width: '12%',
      render: (alert) => <span className="text-xs font-bold text-slate-800">{statusLabel(alert.status)}</span>,
    },
    {
      key: 'conditionStatus',
      header: 'Điều kiện',
      width: '12%',
      render: (alert) => (
        <span className="text-xs font-bold text-slate-800">
          {conditionLabel(alert.conditionStatus)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white">
            <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Báo cáo cảnh báo Fire-Watch</h2>
            <p className="text-xs text-slate-500">
              Lay tu bang cảnh báo thật trong database. Không tính SLA, MTTR hoặc tỷ lệ báo giả khi chưa có dữ liệu nghiệm thu.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition"
        >
          <Download className="w-3.5 h-3.5" />
          Xuất CSV
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Tổng cảnh báo" value={stats.total} helper="Số bản ghi alerts trong DB" />
        <Metric label="Chưa tiếp nhận" value={stats.newCount} helper="status = new" tone="red" />
        <Metric label="Đã tiếp nhận" value={stats.acknowledgedCount} helper="status = acknowledged" tone="emerald" />
        <Metric label="Điều kiện đang active" value={stats.activeConditionCount} helper="Chưa được backend ghi cleared" tone="amber" />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Lịch sử cảnh báo
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Tiếp nhận là thao tác người vận hành. Điều kiện active/cleared do backend cập nhật theo cảm biến và AI.
          </p>
        </div>
        <DataTable
          columns={columns}
          data={alerts}
          keyExtractor={(item) => item.id}
          emptyMessage="Chưa có dữ liệu cảnh báo"
        />
      </div>
    </div>
  );
};

const Metric: React.FC<{
  label: string;
  value: number;
  helper: string;
  tone?: 'slate' | 'red' | 'emerald' | 'amber';
}> = ({ label, value, helper, tone = 'slate' }) => {
  const valueClass =
    tone === 'red'
      ? 'text-red-700'
      : tone === 'emerald'
        ? 'text-emerald-700'
        : tone === 'amber'
          ? 'text-amber-700'
          : 'text-slate-900';

  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
      <div className="text-[11px] font-semibold text-slate-500 mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-2xl font-bold ${valueClass}`}>{value}</span>
        <span className="text-xs text-slate-500">bản ghi</span>
      </div>
      <div className="text-[10px] text-slate-400 mt-1">{helper}</div>
    </div>
  );
};
