import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Download, RefreshCw, ScrollText, Search, X } from 'lucide-react';
import { AuditLog } from '../types';
import { fireWatchService } from '../services';
import { exportToCsv } from '../utils/exportCsv';
import { filterLogEvents, groupLogEvents } from '../utils/logEvents';

const LEVELS = ['CRITICAL', 'WARN', 'INFO', 'ERROR', 'AUDIT'] as const;
const LEVEL_LABELS: Record<string, string> = {
  CRITICAL: 'Nghiêm trọng', WARN: 'Cảnh báo', INFO: 'Thông tin', ERROR: 'Lỗi', AUDIT: 'Thao tác',
};
const formatDate = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' });
const levelClass = (level: string) => level === 'ERROR' || level === 'CRITICAL' ? 'bg-red-100 text-red-700'
  : level === 'WARN' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700';

export const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fireWatchService.getAuditLogs().then(rows => {
      if (mounted) { setLogs(rows); setLoadError(''); }
    }).catch(error => {
      if (mounted) setLoadError(error instanceof Error ? error.message : 'Không tải được nhật ký');
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [reload]);

  const events = useMemo(() => groupLogEvents(logs), [logs]);
  const filtered = useMemo(() => filterLogEvents(events, filterLevel, filterCategory, searchQuery),
    [events, filterLevel, filterCategory, searchQuery]);
  const selected = events.find(event => event.id === selectedId) || null;
  const counters = LEVELS.map(level => ({ level, count: filtered.filter(event => event.level === level).length }));

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const exportCsv = () => exportToCsv(`firewatch_nhat_ky_${Date.now()}.csv`,
    ['Thời gian', 'Mức độ', 'Sự kiện', 'Thiết bị/Khu vực', 'Kết quả'],
    filtered.map(event => [formatDate(event.timestamp), event.level, event.title, event.location, event.result]));
  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(selected?.records, null, 2));
      setCopyStatus('Đã sao chép');
    } catch { setCopyStatus('Không thể sao chép. Bạn có thể chọn nội dung bên dưới.'); }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ScrollText className="w-6 h-6 text-emerald-600" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Nhật ký hệ thống</h2>
            <p className="text-xs text-slate-500 mt-1">Theo dõi sự kiện và kết quả điều khiển thiết bị.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button disabled={loading} onClick={() => setReload(value => value + 1)} className="inline-flex items-center gap-2 border rounded-lg px-3 py-2 text-xs disabled:opacity-50">
            <RefreshCw className="w-4 h-4" />Làm mới
          </button>
          <button disabled={loading || Boolean(loadError) || !filtered.length} onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white px-3 py-2 text-xs disabled:opacity-50">
            <Download className="w-4 h-4" />Xuất CSV
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Thống kê theo kết quả đang lọc, sau khi gộp các bản ghi của cùng một lệnh. Phạm vi: tối đa 500 bản ghi gần nhất.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Counter label="Sự kiện đang lọc" value={filtered.length} />
        {counters.map(({ level, count }) => <Counter key={level} label={LEVEL_LABELS[level]} value={count} />)}
      </div>

      <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-4 items-end text-xs">
        <label className="space-y-1">
          <span className="block text-slate-500">Mức độ</span>
          <select value={filterLevel} onChange={event => setFilterLevel(event.target.value)} className="border rounded-lg p-2">
            <option value="ALL">Tất cả</option>
            {LEVELS.map(level => <option key={level} value={level}>{LEVEL_LABELS[level]} ({level === 'WARN' ? 'Warning' : level})</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-slate-500">Nhóm sự kiện</span>
          <select value={filterCategory} onChange={event => setFilterCategory(event.target.value)} className="border rounded-lg p-2">
            <option value="ALL">Tất cả</option>
            {['Cảnh báo', 'Thiết bị', 'Cấu hình', 'Hệ thống'].map(category => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label className="flex-1 min-w-48">
          <span className="block text-slate-500 mb-1">Tìm kiếm</span>
          <span className="flex items-center border rounded-lg px-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Sự kiện, thiết bị, khu vực..." className="p-2 w-full outline-none" />
          </span>
        </label>
      </div>

      {loadError && <p role="alert" className="p-4 bg-red-50 text-red-700 rounded-lg">Không tải được nhật ký: {loadError}</p>}
      {loading && <p role="status" className="text-sm text-slate-500">Đang tải nhật ký...</p>}
      {!loading && !loadError && <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500"><tr>
            {['Thời gian', 'Mức độ', 'Sự kiện', 'Thiết bị/Khu vực', 'Kết quả'].map(title => <th key={title} className="p-4 whitespace-nowrap">{title}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(event => <tr key={event.id} className="hover:bg-slate-50">
              <td className="p-4 whitespace-nowrap text-slate-500">{formatDate(event.timestamp)}</td>
              <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold ${levelClass(event.level)}`}>{LEVEL_LABELS[event.level] || event.level}</span></td>
              <td className="p-4"><button className="font-semibold text-left text-slate-900 underline decoration-dotted underline-offset-4" onClick={() => { setSelectedId(event.id); setCopyStatus(''); }}>{event.title}</button></td>
              <td className="p-4 text-slate-600">{event.location}</td>
              <td className="p-4 font-medium">{event.result}</td>
            </tr>)}
            {!filtered.length && <tr><td colSpan={5} className="p-8 text-center text-slate-500">{logs.length ? 'Không có sự kiện phù hợp với bộ lọc.' : 'Chưa có nhật ký hệ thống.'}</td></tr>}
          </tbody>
        </table>
      </div>}

      {selected && <>
        <div className="fixed inset-0 bg-slate-900/30 z-40" onClick={() => setSelectedId(null)} />
        <aside role="dialog" aria-modal="true" aria-labelledby="log-detail-title" className="fixed right-0 inset-y-0 w-full md:w-[560px] bg-white shadow-xl z-50 overflow-y-auto p-6 space-y-5">
          <div className="flex justify-between items-start gap-4">
            <div><h3 id="log-detail-title" className="font-bold text-lg">{selected.title}</h3><p className="text-sm text-slate-500 mt-1">{selected.location}</p></div>
            <button aria-label="Đóng chi tiết" onClick={() => setSelectedId(null)} className="p-2"><X className="w-5 h-5" /></button>
          </div>
          <p className="font-medium">{selected.result}</p>
          <p className="text-xs text-slate-500">Cập nhật: {formatDate(selected.timestamp)} · {selected.category}</p>
          {selected.timeline.length > 0 && <div className="space-y-3">
            <h4 className="font-bold text-sm">Quá trình xử lý lệnh</h4>
            {selected.timeline.map((stage, index) => <div key={index} className="border-l-2 border-emerald-500 pl-3">
              <p className="text-sm">{stage.label}</p><p className="text-xs text-slate-500">{stage.timestamp ? formatDate(stage.timestamp) : 'Chưa ghi nhận'}</p>
            </div>)}
          </div>}
          <details className="border rounded-lg p-3">
            <summary className="cursor-pointer text-sm font-semibold">Chi tiết kỹ thuật ({selected.records.length} bản ghi)</summary>
            <button onClick={copyDetails} className="my-3 inline-flex items-center gap-2 text-xs"><Copy className="w-3 h-3" />Sao chép dữ liệu</button>
            {copyStatus && <p role="status" className="text-xs mb-2">{copyStatus}</p>}
            <pre className="text-[11px] whitespace-pre-wrap break-all bg-slate-50 p-3 rounded">{JSON.stringify(selected.records, null, 2)}</pre>
          </details>
        </aside>
      </>}
    </div>
  );
};

const Counter: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-white rounded-xl border p-4">
    <p className="text-[11px] text-slate-500">{label}</p>
    <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
  </div>
);
