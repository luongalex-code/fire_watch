import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { useFireWatch } from '../hooks/useFireWatch';
import { DataTable, Column } from '../components/common/DataTable';
import { AlertEvent } from '../types';
import { fireWatchService } from '../services';
import { exportToCsv } from '../utils/exportCsv';
import { acknowledgementLabel, conditionLabel, confirmationLabel, reportDateBounds, reportStats, severityLabel, sourceLabel } from '../utils/alertReport';

const REPORT_LIMIT = 500;
const formatTime = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' }) : 'Chưa rõ';

export const ReportsPage: React.FC = () => {
  const { areas, currentAreaId } = useFireWatch();
  const [areaId, setAreaId] = useState<string>(currentAreaId);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let mounted = true;
    setRows([]);
    setError('');
    if (from && to && from > to) {
      setError('Ngày bắt đầu phải trước hoặc trùng ngày kết thúc.');
      setLoading(false);
      return;
    }
    setLoading(true);
    fireWatchService.getAlerts({
      areaId: areaId === 'ALL' ? undefined : areaId,
      ...reportDateBounds(from, to), limit: REPORT_LIMIT,
    }).then(alerts => { if (mounted) setRows(alerts); })
      .catch(reason => { if (mounted) setError(reason instanceof Error ? reason.message : 'Không tải được báo cáo'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [areaId, from, to, reload]);

  const stats = useMemo(() => reportStats(rows), [rows]);
  const areaName = areaId === 'ALL' ? 'Tất cả khu vực' : areas.find(area => area.id === areaId)?.name || areaId;

  const exportCsv = () => exportToCsv(`firewatch_bao_cao_${Date.now()}.csv`,
    ['Mã cảnh báo', 'Bắt đầu', 'Phát hiện gần nhất', 'Khu vực', 'Nguồn', 'Xác nhận', 'Mức độ', 'Tiếp nhận', 'Điều kiện cháy', 'Người tiếp nhận'],
    rows.map(alert => [
      alert.code, formatTime(alert.startedAtMs), formatTime(alert.lastDetectedAtMs), alert.areaName,
      sourceLabel(alert), confirmationLabel(alert), severityLabel(alert), acknowledgementLabel(alert),
      conditionLabel(alert), alert.operatorName || '',
    ]));

  const columns: Column<AlertEvent>[] = [
    { key: 'code', header: 'Mã cảnh báo', render: alert => <Link className="font-mono font-bold text-blue-700 hover:underline" to={`/alerts/${alert.id}`}>{alert.code}</Link> },
    { key: 'time', header: 'Thời điểm', render: alert => <div className="whitespace-nowrap">
      <div>{formatTime(alert.startedAtMs)}</div>
      {alert.lastDetectedAtMs !== alert.startedAtMs && <div className="text-[10px] text-slate-500 mt-1">Gần nhất: {formatTime(alert.lastDetectedAtMs)}</div>}
    </div> },
    { key: 'areaName', header: 'Khu vực' },
    { key: 'source', header: 'Nguồn', render: alert => sourceLabel(alert) },
    { key: 'confirmation', header: 'Xác nhận', render: alert => <span className="text-slate-600">{confirmationLabel(alert)}</span> },
    { key: 'severity', header: 'Mức độ', render: alert => severityLabel(alert) },
    { key: 'status', header: 'Tiếp nhận', render: alert => acknowledgementLabel(alert) },
    { key: 'conditionStatus', header: 'Điều kiện cháy', render: alert => <span className={alert.conditionStatus === 'active' ? 'font-bold text-amber-800' : 'text-slate-600'}>{conditionLabel(alert)}</span> },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-6 h-6 text-cyan-600" />
          <h2 className="text-base font-bold text-slate-900">Báo cáo</h2>
        </div>
        <div className="flex gap-2">
          <button disabled={loading} onClick={() => setReload(value => value + 1)} className="inline-flex gap-2 items-center border rounded-lg px-3 py-2 text-xs disabled:opacity-50"><RefreshCw className="w-4 h-4" />Làm mới</button>
          <button disabled={loading || Boolean(error) || !rows.length} onClick={exportCsv} className="inline-flex gap-2 items-center bg-slate-900 text-white rounded-lg px-3 py-2 text-xs disabled:opacity-50"><Download className="w-4 h-4" />Xuất CSV</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 items-end bg-white border rounded-lg p-4 text-xs">
        <label className="space-y-1"><span className="block text-slate-500">Khu vực</span>
          <select value={areaId} onChange={event => setAreaId(event.target.value)} className="border rounded p-2">
            <option value="ALL">Tất cả khu vực</option>
            {areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
          </select>
        </label>
        <label className="space-y-1"><span className="block text-slate-500">Từ ngày</span><input type="date" value={from} onChange={event => setFrom(event.target.value)} className="border rounded p-2" /></label>
        <label className="space-y-1"><span className="block text-slate-500">Đến ngày</span><input type="date" value={to} onChange={event => setTo(event.target.value)} className="border rounded p-2" /></label>
        <button onClick={() => { setFrom(''); setTo(''); }} className="border rounded px-3 py-2">Tất cả thời gian</button>
      </div>

      <p className="text-xs text-slate-500">
        {areaName} · Ngày bắt đầu cảnh báo: {from || 'Không giới hạn'} → {to || 'Không giới hạn'} (giờ Việt Nam).
        Thẻ thống kê, bảng và CSV cùng dùng {rows.length} bản ghi đã tải; tối đa {REPORT_LIMIT} bản ghi mới nhất trong bộ lọc.
      </p>
      {rows.length === REPORT_LIMIT && <p role="status" className="text-xs text-amber-800">Đã đạt giới hạn hiển thị. Chọn khoảng ngày hẹp hơn để xem các bản ghi khác.</p>}
      {error && <p role="alert" className="rounded bg-red-50 text-red-700 p-4 text-sm">Không tải được báo cáo: {error}</p>}
      {loading ? <p role="status" className="text-sm text-slate-500">Đang tải báo cáo...</p> : !error && <>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Metric label="Tổng bản ghi cảnh báo" value={stats.total} />
          <Metric label="Chưa tiếp nhận" value={stats.unacknowledged} />
          <Metric label="Đã tiếp nhận" value={stats.acknowledged} />
          <Metric label="Đang còn điều kiện" value={stats.active} />
          <Metric label="Đã hết điều kiện" value={stats.cleared} />
        </div>
        {stats.unknown > 0 && <p className="text-xs text-slate-500">{stats.unknown} bản ghi chưa rõ trạng thái điều kiện.</p>}
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="font-bold text-sm">Lịch sử cảnh báo</h3>
          <p className="text-xs text-slate-500">Mỗi dòng là một bản ghi theo nguồn, không phải số vụ cháy. Chọn mã để xem chi tiết.</p>
          <p className="text-xs text-slate-500">Mức độ thể hiện mức ưu tiên. Phát hiện đơn nguồn chưa chứng minh đã xác nhận kép; tiếp nhận và điều kiện cháy là hai trạng thái độc lập.</p>
          <DataTable columns={columns} data={rows} keyExtractor={alert => alert.id} emptyMessage="Không có bản ghi cảnh báo trong bộ lọc này." />
        </div>
      </>}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-white p-3 rounded-lg border border-slate-200">
    <p className="text-[11px] text-slate-500">{label}</p>
    <p className="text-2xl font-bold text-slate-900 mt-1">{value} <span className="text-xs font-normal text-slate-500">bản ghi</span></p>
  </div>
);
