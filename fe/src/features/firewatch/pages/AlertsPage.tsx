import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellRing, CheckCircle, ArrowRight, Search } from 'lucide-react';
import { useFireWatch } from '../hooks/useFireWatch';
import { AlertEvent } from '../types';
import { DataTable, Column } from '../components/common/DataTable';
import { getConditionLabel, getSeverityLabel, getStatusLabel } from '../utils/formatters';

export const AlertsPage: React.FC = () => {
  const { alerts, acknowledgeAlert } = useFireWatch();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter] = useState('all');

  const filteredAlerts = alerts.filter((alert) => {
    if (statusFilter === 'new' && alert.status !== 'new') return false;
    if (statusFilter === 'acknowledged' && alert.status !== 'acknowledged') return false;
    if (statusFilter === 'active' && !alert.isActive) return false;
    if (statusFilter === 'cleared' && alert.isActive) return false;
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    if (!searchQuery) return true;

    const q = searchQuery.toLowerCase();
    return (
      alert.code.toLowerCase().includes(q) ||
      alert.title.toLowerCase().includes(q) ||
      alert.areaName.toLowerCase().includes(q) ||
      alert.sourceDescription.toLowerCase().includes(q)
    );
  });

  const columns: Column<AlertEvent>[] = [
    {
      key: 'code',
      header: 'Mã sự kiện',
      width: '12%',
      render: (item) => <span className="font-mono font-bold text-red-600 text-xs">{item.code}</span>,
    },
    {
      key: 'timestamp',
      header: 'Thời điểm',
      width: '16%',
      render: (item) => <div className="font-mono text-[11px] text-slate-700">{item.timestamp}</div>,
    },
    {
      key: 'areaName',
      header: 'Khu vực',
      width: '18%',
      render: (item) => (
        <div>
          <div className="font-semibold text-slate-900">{item.areaName}</div>
          <div className="text-[10px] text-slate-500 font-mono">{item.sourceDescription}</div>
        </div>
      ),
    },
    {
      key: 'severity',
      header: 'Mức độ',
      width: '12%',
      align: 'center',
      render: (item) => {
        const sev = getSeverityLabel(item.severity);
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${sev.bg} ${sev.textCol} ${sev.border}`}>
            {sev.text}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Tiếp nhận / Điều kiện',
      width: '18%',
      align: 'center',
      render: (item) => {
        const st = getStatusLabel(item.status);
        const condition = getConditionLabel(item.conditionStatus);
        return (
          <div className="flex flex-col items-center gap-1">
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${st.bg} ${st.textCol}`}>
              {st.text}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${condition.bg} ${condition.textCol}`}>
              {condition.text}
            </span>
          </div>
        );
      },
    },
    {
      key: 'operatorName',
      header: 'Người tiếp nhận',
      width: '14%',
      render: (item) => (
        <span className="text-[11px] text-slate-700 font-medium">
          {item.operatorName || <span className="text-slate-400 italic">Chưa tiếp nhận</span>}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Thao tác',
      width: '10%',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {item.status === 'new' && (
            <button
              onClick={() => acknowledgeAlert(item.id)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 rounded transition"
              title="Đã tiếp nhận"
            >
              <CheckCircle className="w-3 h-3" />
              Đã tiếp nhận
            </button>
          )}
          <Link
            to={`/alerts/${item.id}`}
            className="p-1 text-slate-600 hover:text-slate-950 hover:bg-slate-100 rounded transition"
            title="Xem chi tiet"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center text-white">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Trung tâm cảnh báo cháy</h2>
            <p className="text-xs text-slate-500 font-mono">
              Theo doi cảnh báo tu ESP32 va camera AI. Tiếp nhận khong lam tat bom, coi hoặc den.
            </p>
          </div>
        </div>
        <div className="text-xs font-mono text-slate-500">
          Tong cong: <strong>{alerts.length} sự kiện</strong>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-medium">
          <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
            Tất cả ({alerts.length})
          </FilterButton>
          <FilterButton active={statusFilter === 'new'} onClick={() => setStatusFilter('new')} tone="red">
            Mới ({alerts.filter((a) => a.status === 'new').length})
          </FilterButton>
          <FilterButton active={statusFilter === 'acknowledged'} onClick={() => setStatusFilter('acknowledged')} tone="blue">
            Đã tiếp nhận ({alerts.filter((a) => a.status === 'acknowledged').length})
          </FilterButton>
          <FilterButton active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} tone="red">
            Điều kiện active ({alerts.filter((a) => a.isActive).length})
          </FilterButton>
          <FilterButton active={statusFilter === 'cleared'} onClick={() => setStatusFilter('cleared')} tone="emerald">
            Điều kiện đã hết ({alerts.filter((a) => a.conditionStatus === 'cleared').length})
          </FilterButton>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo mã, khu vực, nguồn..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1 text-xs rounded-md border border-slate-300 focus:outline-hidden focus:border-slate-800 w-64"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredAlerts}
        keyExtractor={(item) => item.id}
        emptyMessage="Không tìm thấy cảnh báo phù hợp"
        onRowClick={(item) => navigate(`/alerts/${item.id}`)}
      />
    </div>
  );
};

const FilterButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'red' | 'blue' | 'emerald';
}> = ({ active, onClick, children, tone }) => {
  const activeClass =
    tone === 'red'
      ? 'bg-red-600 text-white'
      : tone === 'blue'
        ? 'bg-blue-600 text-white'
        : tone === 'emerald'
          ? 'bg-emerald-600 text-white'
          : 'bg-slate-900 text-white';

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md transition ${active ? `${activeClass} font-bold` : 'text-slate-600 hover:bg-slate-100'}`}
    >
      {children}
    </button>
  );
};
