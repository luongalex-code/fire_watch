import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Download, ScrollText, Search, X, Clock, Activity, Settings, User, AlertTriangle, ShieldCheck, Database, CheckCircle2, CircleDashed, ArrowRight } from 'lucide-react';
import { useFireWatch } from '../hooks/useFireWatch';
import { AuditLog } from '../types';
import { fireWatchService } from '../services';
import { exportToCsv } from '../utils/exportCsv';

const EVENT_LABELS: Record<string, string> = {
  alert_acknowledged: 'Cảnh báo đã được tiếp nhận',
  alert_created: 'Cảnh báo được tạo',
  alert_resolved: 'Cảnh báo đã kết thúc',
  pump_on: 'Máy bơm được bật',
  pump_off: 'Máy bơm được tắt',
  config_updated: 'Cấu hình hệ thống được cập nhật',
  mqtt_command_sent: 'Đã gửi lệnh tới thiết bị',
  command_created: 'Lệnh đã được tạo',
  command_acknowledged: 'Thiết bị đã nhận và áp dụng lệnh',
  device_connected: 'Thiết bị đã kết nối',
  device_disconnected: 'Thiết bị mất kết nối',
};

const formatEvent = (action?: string, message?: string) => {
  if (action && EVENT_LABELS[action]) return EVENT_LABELS[action];
  return message || action || 'Sự kiện hệ thống';
};

const formatDate = (isoString: string) => {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${dateStr} · ${timeStr}`;
};

const LogDetailsDrawer: React.FC<{
  log: AuditLog;
  allLogs: AuditLog[];
  onClose: () => void;
  onCopyJson: () => void;
}> = ({ log, allLogs, onClose, onCopyJson }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'raw'>('overview');

  const history = useMemo(() => {
    let related: AuditLog[] = [];
    const details = log.details || {};
    const commandId = details.command_uuid || (log.channel?.includes('command') ? log.id : null);
    
    if (log.channel?.includes('alert') && log.device) {
      related = allLogs.filter(l => l.device === log.device && l.channel?.includes('alert'));
    } else if (commandId) {
      related = allLogs.filter(l => l.details?.command_uuid === commandId || l.id === commandId);
    } else {
      related = [log];
    }
    
    return related.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [log, allLogs]);

  const commandFlow = useMemo(() => {
    if (!log.details?.command_uuid) return null;
    const cid = log.details.command_uuid;
    const created = allLogs.find(l => l.channel === 'command_created' && l.details?.command_uuid === cid);
    const sent = allLogs.find(l => l.channel === 'mqtt_command_sent' && l.details?.command_uuid === cid);
    const acked = allLogs.find(l => l.channel === 'command_acknowledged' && l.details?.command_uuid === cid);
    
    return { created, sent, acked };
  }, [log, allLogs]);

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-slate-50 shadow-2xl z-50 flex flex-col border-l border-slate-200">
      <div className="bg-slate-900 text-white p-6 pb-0 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg">
              <ScrollText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">CHI TIẾT SỰ KIỆN</h2>
              <div className="text-lg font-semibold mt-1">{formatEvent(log.channel, log.message)}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-slate-300 pb-4">
          <span>{formatDate(log.timestamp)}</span>
          <span className="px-1.5 py-0.5 bg-slate-800 rounded">{log.level}</span>
          <span className="px-1.5 py-0.5 bg-slate-800 rounded">{log.source}</span>
        </div>
        <div className="flex gap-4 border-b border-slate-700 text-sm font-medium overflow-x-auto">
          <button onClick={() => setActiveTab('overview')} className={`pb-3 whitespace-nowrap ${activeTab === 'overview' ? 'text-white border-b-2 border-emerald-400' : 'text-slate-400'}`}>Tổng quan</button>
          <button onClick={() => setActiveTab('history')} className={`pb-3 whitespace-nowrap ${activeTab === 'history' ? 'text-white border-b-2 border-emerald-400' : 'text-slate-400'}`}>Lịch sử</button>
          <button onClick={() => setActiveTab('raw')} className={`pb-3 whitespace-nowrap ${activeTab === 'raw' ? 'text-white border-b-2 border-emerald-400' : 'text-slate-400'}`}>Dữ liệu kỹ thuật</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase">Thông tin chung</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-slate-500 mb-1">Thời gian</div>
                  <div className="font-mono text-slate-900 font-medium">{formatDate(log.timestamp)}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Mức độ</div>
                  <div className="font-medium text-slate-900">{log.level}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Thành phần</div>
                  <div className="font-medium text-slate-900">{log.source}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Sự kiện</div>
                  <div className="font-medium text-slate-900">{formatEvent(log.channel)}</div>
                </div>
                {log.operator && (
                  <div>
                    <div className="text-slate-500 mb-1">Người thao tác</div>
                    <div className="font-medium text-slate-900 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {log.operator}</div>
                  </div>
                )}
                {log.device && (
                  <div>
                    <div className="text-slate-500 mb-1">Thiết bị / ID</div>
                    <div className="font-medium font-mono text-slate-900">{log.device}</div>
                  </div>
                )}
              </div>
            </div>

            {commandFlow && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase">Quá trình xử lý lệnh</h3>
                <div className="relative pl-3 space-y-6 before:absolute before:inset-y-0 before:left-[15px] before:w-0.5 before:bg-slate-200">
                  <div className="relative z-10 flex items-start gap-3">
                    <div className={`w-3 h-3 rounded-full mt-1 outline outline-2 outline-white ${commandFlow.created ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Backend: Đã tạo lệnh</div>
                      {commandFlow.created && <div className="text-[11px] text-slate-500 font-mono mt-0.5">Command ID: {String(log.details?.command_uuid)}</div>}
                    </div>
                  </div>
                  <div className="relative z-10 flex items-start gap-3">
                    <div className={`w-3 h-3 rounded-full mt-1 outline outline-2 outline-white ${commandFlow.sent ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <div>
                      <div className="text-xs font-bold text-slate-900">MQTT: Đã publish</div>
                      {commandFlow.sent ? <div className="text-[11px] text-slate-500 font-mono mt-0.5">{formatDate(commandFlow.sent.timestamp)}</div> : <div className="text-[11px] text-slate-400 italic">Đang chờ gửi...</div>}
                    </div>
                  </div>
                  <div className="relative z-10 flex items-start gap-3">
                    <div className={`w-3 h-3 rounded-full mt-1 outline outline-2 outline-white ${commandFlow.acked ? 'bg-blue-500' : 'bg-slate-300'}`} />
                    <div>
                      <div className="text-xs font-bold text-slate-900">ESP32: Đã nhận & Áp dụng</div>
                      {commandFlow.acked ? <div className="text-[11px] text-slate-500 font-mono mt-0.5">{formatDate(commandFlow.acked.timestamp)}</div> : <div className="text-[11px] text-slate-400 italic">Chưa có xác nhận từ thiết bị</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {Boolean(log.details?.changed_keys) && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase">Dữ liệu thay đổi</h3>
                <div className="space-y-2">
                  {Object.entries((log.details?.changed_keys || {}) as Record<string, {from: any, to: any}>).map(([k, v]) => (
                    <div key={k} className="text-[11px] bg-slate-50 p-2 rounded border border-slate-100 flex flex-col gap-1">
                      <span className="font-bold text-slate-700">{k}</span>
                      <div className="flex items-center gap-2 font-mono text-slate-600">
                        <span className="line-through opacity-70">{JSON.stringify(v.from)}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="text-emerald-600 font-semibold">{JSON.stringify(v.to)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {log.details && Object.keys(log.details).filter(k => k !== 'changed_keys' && k !== 'level' && k !== 'message').length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase">Dữ liệu đi kèm</h3>
                <div className="grid grid-cols-1 gap-2 text-[11px] font-mono">
                  {Object.entries(log.details).filter(([k]) => k !== 'changed_keys' && k !== 'level' && k !== 'message').map(([k, v]) => (
                    <div key={k} className="flex flex-col p-2 bg-slate-50 rounded border border-slate-100">
                      <span className="text-slate-500 font-sans font-semibold text-xs mb-1">{k}</span>
                      <span className="text-slate-800 break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase mb-4">Lịch sử sự kiện liên quan</h3>
            <div className="relative pl-3 space-y-6 before:absolute before:inset-y-0 before:left-[15px] before:w-0.5 before:bg-slate-200">
              {history.map((hlog, idx) => (
                <div key={hlog.id || idx} className="relative z-10 flex items-start gap-4">
                  <div className={`w-3 h-3 rounded-full mt-1 outline outline-2 outline-slate-50 ${hlog.id === log.id ? 'bg-indigo-500 ring-4 ring-indigo-100' : 'bg-slate-300'}`} />
                  <div className={`flex-1 bg-white p-3 rounded-xl border shadow-sm ${hlog.id === log.id ? 'border-indigo-200' : 'border-slate-200'}`}>
                    <div className="text-[10px] text-slate-500 font-mono mb-1">{formatDate(hlog.timestamp)}</div>
                    <div className="text-xs font-bold text-slate-900 mb-1">{formatEvent(hlog.channel, hlog.message)}</div>
                    <div className="text-[11px] text-slate-600">{hlog.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase">JSON Gốc</h3>
              <button onClick={onCopyJson} className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded transition">
                <Copy className="w-3.5 h-3.5" /> Sao chép
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-y-auto whitespace-pre-wrap break-words border border-slate-800 max-h-[60vh] shadow-inner">
              {JSON.stringify(log, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};


export const LogsPage: React.FC = () => {
  const { showToast } = useFireWatch();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
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
      if (filterCategory !== 'ALL') {
        const cat = filterCategory;
        const s = log.source.toLowerCase();
        const c = log.channel?.toLowerCase() || '';
        if (cat === 'Cảnh báo' && !s.includes('alert') && !c.includes('alert')) return false;
        if (cat === 'Thiết bị' && !s.includes('device') && !c.includes('device') && !s.includes('command') && !c.includes('command')) return false;
        if (cat === 'Cấu hình' && !s.includes('system') && !c.includes('config')) return false;
      }
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.source.toLowerCase().includes(q) ||
        (log.channel && log.channel.toLowerCase().includes(q)) ||
        (log.operator && log.operator.toLowerCase().includes(q)) ||
        (log.device && log.device.toLowerCase().includes(q)) ||
        (log.details?.command_uuid && String(log.details.command_uuid).toLowerCase().includes(q)) ||
        (log.details?.alert_id && String(log.details.alert_id).toLowerCase().includes(q))
      );
    });
  }, [filterLevel, filterCategory, logs, searchQuery]);

  const counters = useMemo(() => {
    return {
      total: logs.length,
      critical: logs.filter((log) => log.level === 'CRITICAL').length,
      warn: logs.filter((log) => log.level === 'WARN').length,
      error: logs.filter((log) => log.level === 'ERROR').length,
      audit: logs.filter((log) => log.level === 'AUDIT' || log.level === 'INFO').length,
    };
  }, [logs]);

  const handleExportCsv = () => {
    const headers = ['Thời điểm', 'Cấp độ', 'Phần hệ', 'Sự kiện', 'Nội dung', 'Nguoi/Thiết bị'];
    const rows = filteredLogs.map((log) => [
      log.timestamp,
      log.level,
      log.source,
      formatEvent(log.channel),
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
    <div className="space-y-4 max-w-7xl mx-auto pb-12 relative">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-inner">
            <ScrollText className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Nhật ký hệ thống</h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Tra cứu lịch sử cảnh báo, tương tác thiết bị và cập nhật hệ thống.
            </p>
          </div>
        </div>

        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition"
        >
          <Download className="w-4 h-4" />
          Xuất CSV
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Counter label="Tổng sự kiện" value={counters.total} />
        <Counter label="Cảnh báo quan trọng" value={counters.critical} tone="red" />
        <Counter label="Cảnh báo hệ thống" value={counters.warn} tone="amber" />
        <Counter label="Lỗi" value={counters.error} tone="red" />
        <Counter label="Thao tác / Hệ thống" value={counters.audit} tone="emerald" />
      </div>

      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-2">
          <div className="flex items-center gap-1.5 overflow-x-auto font-medium">
            <span className="text-slate-400 font-bold mr-1 uppercase text-[10px]">Mức độ:</span>
            {['ALL', 'CRITICAL', 'WARN', 'INFO', 'ERROR', 'AUDIT'].map((level) => (
              <button
                key={level}
                onClick={() => setFilterLevel(level)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition ${
                  filterLevel === level ? 'bg-slate-900 text-white shadow-sm' : 'bg-transparent text-slate-600 hover:bg-slate-100'
                }`}
              >
                {level === 'ALL' ? 'Tất cả' : level}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-slate-200 hidden sm:block" />
          <div className="flex items-center gap-1.5 overflow-x-auto font-medium">
            <span className="text-slate-400 font-bold mr-1 uppercase text-[10px]">Nhóm:</span>
            {['ALL', 'Cảnh báo', 'Thiết bị', 'Cấu hình'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition ${
                  filterCategory === cat ? 'bg-slate-100 text-slate-900 shadow-sm' : 'bg-transparent text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat === 'ALL' ? 'Tất cả' : cat}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-auto p-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm sự kiện, thiết bị, khu vực, lệnh..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-slate-400 focus:ring-1 focus:ring-slate-400 w-full sm:w-80 transition"
          />
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-3 font-medium">
          <AlertTriangle className="w-5 h-5 text-red-500" /> Không tải được audit log: {loadError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 z-10 text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th className="p-3.5 whitespace-nowrap">Thời gian</th>
                <th className="p-3.5 whitespace-nowrap">Mức độ</th>
                <th className="p-3.5 whitespace-nowrap">Thành phần</th>
                <th className="p-3.5 whitespace-nowrap">Sự kiện</th>
                <th className="p-3.5 whitespace-nowrap">Thiết bị/Khu vực</th>
                <th className="p-3.5 w-full">Nội dung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[12px] font-medium text-slate-700">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={`cursor-pointer transition hover:bg-slate-50 ${selectedLog?.id === log.id ? 'bg-slate-50' : ''}`}
                >
                  <td className="p-3.5 whitespace-nowrap font-mono text-[11px] text-slate-500">{formatDate(log.timestamp)}</td>
                  <td className="p-3.5">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide
                      ${log.level === 'CRITICAL' || log.level === 'ERROR' ? 'bg-red-100 text-red-700' : 
                        log.level === 'WARN' ? 'bg-amber-100 text-amber-700' : 
                        log.level === 'INFO' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="p-3.5 whitespace-nowrap text-slate-900">{log.source}</td>
                  <td className="p-3.5 whitespace-nowrap font-bold text-slate-900">{formatEvent(log.channel)}</td>
                  <td className="p-3.5 whitespace-nowrap text-slate-600 font-mono text-[11px]">{log.device || log.operator || '-'}</td>
                  <td className="p-3.5 text-slate-600 truncate max-w-[200px] sm:max-w-md">{log.message}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">Không tìm thấy bản ghi nào phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLog && (
        <>
          <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs z-40" onClick={() => setSelectedLog(null)} />
          <LogDetailsDrawer 
            log={selectedLog} 
            allLogs={logs} 
            onClose={() => setSelectedLog(null)} 
            onCopyJson={handleCopyJson} 
          />
        </>
      )}
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
      ? 'text-red-600'
      : tone === 'amber'
        ? 'text-amber-600'
        : tone === 'emerald'
          ? 'text-emerald-600'
          : 'text-slate-800';

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{label}</div>
      <div className={`font-mono text-3xl font-black tracking-tight ${valueClass}`}>{value}</div>
    </div>
  );
};
