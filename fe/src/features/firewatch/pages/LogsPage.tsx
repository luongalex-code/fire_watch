import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Download, ScrollText, Search } from 'lucide-react';
import { useFireWatch } from '../hooks/useFireWatch';
import { AuditLog } from '../types';
import { fireWatchService } from '../services';
import { exportToCsv } from '../utils/exportCsv';

export const LogsPage: React.FC = () => {
  const { showToast } = useFireWatch();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let mounted = true;
    fireWatchService
      .getAuditLogs()
      .then((rows) => {
        if (!mounted) return;
        setLogs(rows);
        setSelectedLog(rows[0] || null);
        setLoadError('');
      })
      .catch((error) => {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : 'Không tải được audit log');
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterLevel !== 'ALL' && log.level !== filterLevel) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.source.toLowerCase().includes(q) ||
        (log.channel && log.channel.toLowerCase().includes(q)) ||
        (log.operator && log.operator.toLowerCase().includes(q)) ||
        (log.device && log.device.toLowerCase().includes(q))
      );
    });
  }, [filterLevel, logs, searchQuery]);

  const counters = useMemo(() => {
    return {
      total: logs.length,
      critical: logs.filter((log) => log.level === 'CRITICAL').length,
      warn: logs.filter((log) => log.level === 'WARN').length,
      error: logs.filter((log) => log.level === 'ERROR').length,
      audit: logs.filter((log) => log.level === 'AUDIT').length,
    };
  }, [logs]);

  const handleExportCsv = () => {
    const headers = ['Thời điểm', 'Cấp độ', 'Phần hệ', 'Kenh/Topic/Chan', 'Nội dung', 'Nguoi/Thiết bị'];
    const rows = filteredLogs.map((log) => [
      log.timestamp,
      log.level,
      log.source,
      log.channel || '',
      log.message,
      log.operator || log.device || '',
    ]);
    exportToCsv(`firewatch_audit_logs_${Date.now()}.csv`, headers, rows);
  };

  const handleCopyJson = async () => {
    if (!selectedLog) return;
    await navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
    showToast({
      type: 'success',
      title: 'Đã sao chép log',
      message: 'Bản ghi audit đã được copy vào clipboard.',
    });
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white">
            <ScrollText className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Nhật ký hệ thống</h2>
            <p className="text-xs text-slate-500">
              Lấy từ audit log backend. Không hiển thị so goi tin, CRC hay thong so chua duoc luu trong database.
            </p>
          </div>
        </div>

        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition"
        >
          <Download className="w-3.5 h-3.5" />
          Xuất CSV
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Counter label="Tổng log" value={counters.total} />
        <Counter label="Critical" value={counters.critical} tone="red" />
        <Counter label="Warn" value={counters.warn} tone="amber" />
        <Counter label="Error" value={counters.error} tone="red" />
        <Counter label="Audit" value={counters.audit} tone="emerald" />
      </div>

      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto font-medium">
          <span className="text-slate-400 font-mono mr-1">CAP DO:</span>
          {['ALL', 'CRITICAL', 'WARN', 'INFO', 'ERROR', 'AUDIT'].map((level) => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition ${
                filterLevel === level ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tim theo noi dung, topic, thiết bị..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-8 pr-3 py-1 text-xs rounded-md border border-slate-300 focus:outline-hidden w-72 font-mono"
          />
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          Không tải được audit log: <span className="font-mono">{loadError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900">Bảng audit log</span>
            <span className="font-mono text-[11px] text-slate-500">{filteredLogs.length} bản ghi</span>
          </div>

          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-2 whitespace-nowrap">Thời điểm</th>
                  <th className="p-2 whitespace-nowrap">Cấp độ</th>
                  <th className="p-2 whitespace-nowrap">Phần hệ</th>
                  <th className="p-2 whitespace-nowrap">Kenh/Topic/Chan</th>
                  <th className="p-2 font-sans">Nội dung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-[11px]">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`cursor-pointer transition hover:bg-blue-50/60 ${selectedLog?.id === log.id ? 'bg-blue-50 font-medium' : ''}`}
                  >
                    <td className="p-2 text-slate-700 whitespace-nowrap">{log.timestamp}</td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700 font-bold">
                        {log.level}
                      </span>
                    </td>
                    <td className="p-2 font-bold text-slate-800 whitespace-nowrap">{log.source}</td>
                    <td className="p-2 text-slate-500 whitespace-nowrap">{log.channel || '-'}</td>
                    <td className="p-2 font-sans text-slate-800 max-w-md truncate">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Chi tiet bản ghi
            </h3>
            <button
              onClick={handleCopyJson}
              disabled={!selectedLog}
              className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold disabled:text-slate-300"
            >
              <Copy className="w-3 h-3" />
              Sao chep
            </button>
          </div>

          {selectedLog ? (
            <pre className="p-3 rounded-lg bg-slate-950 text-emerald-400 font-mono text-[10px] overflow-x-auto leading-relaxed border border-slate-800 max-h-96">
{JSON.stringify(selectedLog, null, 2)}
            </pre>
          ) : (
            <div className="text-center p-8 text-xs text-slate-400">Chưa có dữ liệu log</div>
          )}
        </div>
      </div>
    </div>
  );
};

const Counter: React.FC<{ label: string; value: number; tone?: 'slate' | 'red' | 'amber' | 'emerald' }> = ({
  label,
  value,
  tone = 'slate',
}) => {
  const valueClass =
    tone === 'red'
      ? 'text-red-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : tone === 'emerald'
          ? 'text-emerald-700'
          : 'text-slate-900';

  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
      <div className="text-[10px] font-semibold text-slate-500 mb-0.5">{label}</div>
      <div className={`font-mono text-xl font-bold ${valueClass}`}>{value}</div>
      <div className="text-[9px] text-slate-500 font-mono">Tu backend</div>
    </div>
  );
};
