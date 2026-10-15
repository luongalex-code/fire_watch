import React, { useCallback, useEffect, useState } from 'react';
import { Image as ImageIcon, RefreshCcw, X } from 'lucide-react';
import { modelLabel } from '../../utils/modelLabels';

interface Capture {
  id: number;
  alert_id?: number | null;
  frame_at: string;
  model_name: string;
  snapshot_path?: string | null;
  detections: { label: string; confidence: number }[];
}
interface Group { key: string; count: number; first_at: string; last_at: string; latest: Capture }
export interface CaptureSummary { images: number; groups: number; model: string }
const api = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const camera = (import.meta.env.VITE_CAMERA_SERVICE_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const date = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' });
const label = (value: string) => ({ fire: 'Lửa', smoke: 'Khói', person: 'Người' }[value.trim().toLowerCase()] || value);
const types = (capture: Capture) => [...new Set(capture.detections.map(item => label(item.label)))].join(' / ') || 'Chưa có nhận diện';
const confidence = (capture: Capture) => capture.detections.length
  ? `${(Math.max(...capture.detections.map(item => item.confidence)) * 100).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : 'Chưa rõ';
const title = (group: Group) => group.latest.alert_id != null ? `EV-${String(group.latest.alert_id).padStart(4, '0')}` : 'Ảnh chưa gắn cảnh báo';

function Photo({ capture, large = false }: { capture: Capture; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const file = capture.snapshot_path?.replace(/\\/g, '/').split('/').pop();
  const url = /^https?:\/\//i.test(capture.snapshot_path || '') ? capture.snapshot_path : file ? `${camera}/captures/${encodeURIComponent(file)}` : '';
  useEffect(() => setFailed(false), [url]);
  return <div className={`bg-slate-950 flex items-center justify-center overflow-hidden rounded ${large ? 'min-h-48' : 'h-20 w-28 sm:w-32 shrink-0'}`}>
    {url && !failed ? <img loading="lazy" src={url} onError={() => setFailed(true)} alt={`Ảnh nhận diện ${date(capture.frame_at)}`} className={large ? 'w-full max-h-[55vh] object-contain' : 'w-full h-full object-cover'} />
      : <span className="text-[11px] text-slate-400 p-3 text-center">Không tải được ảnh</span>}
  </div>;
}

export const CaptureHistory: React.FC<{ reload: number; onSummary: (summary: CaptureSummary) => void }> = ({ reload, onSummary }) => {
  const [day, setDay] = useState('');
  const [kind, setKind] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [visible, setVisible] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<Group | null>(null);
  const [photos, setPhotos] = useState<Capture[]>([]);
  const [current, setCurrent] = useState<Capture | null>(null);
  const [offset, setOffset] = useState(0);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoRetry, setPhotoRetry] = useState(0);
  const params = useCallback(() => {
    const query = new URLSearchParams();
    if (day) query.set('day', day);
    if (kind) query.set('label', kind);
    return query;
  }, [day, kind]);

  useEffect(() => {
    setVisible(5); setSelected(null); setGroups([]);
    onSummary({ images: 0, groups: 0, model: '' });
  }, [day, kind, onSummary]);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${api}/api/vision/capture-groups?${params()}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`API ${response.status}`);
        const data = await response.json() as { groups: Group[]; has_more: boolean };
        if (controller.signal.aborted) return;
        setGroups(data.groups); setHasMore(data.has_more); setError('');
        onSummary({ images: data.groups.reduce((sum, group) => sum + group.count, 0), groups: data.groups.length, model: data.groups[0]?.latest.model_name || '' });
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không tải được ảnh');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 8000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [params, reload, refresh, onSummary]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    const query = params();
    if (selected.latest.alert_id != null) query.set('alert_id', String(selected.latest.alert_id));
    else query.set('capture_id', String(selected.latest.id));
    query.set('offset', String(offset));
    setPhotoLoading(true); setPhotoError('');
    fetch(`${api}/api/vision/captures?${query}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(`API ${response.status}`);
      const rows = await response.json() as Capture[];
      if (!controller.signal.aborted) setPhotos(previous => {
        const byId = new Map((offset ? [...previous, ...rows] : rows).map(row => [row.id, row]));
        return [...byId.values()].sort((a, b) => Date.parse(a.frame_at) - Date.parse(b.frame_at) || a.id - b.id);
      });
    }).catch(reason => { if (!controller.signal.aborted) setPhotoError(reason instanceof Error ? reason.message : 'Không tải được ảnh'); })
      .finally(() => { if (!controller.signal.aborted) setPhotoLoading(false); });
    return () => controller.abort();
  }, [selected, offset, params, photoRetry]);

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [selected]);

  const open = (group: Group) => { setPhotos([]); setOffset(0); setCurrent(group.latest); setSelected(group); };
  return <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-bold text-sm flex gap-2 items-center"><ImageIcon className="w-4 h-4" />Ảnh theo cảnh báo</h3>
      <div className="flex flex-wrap gap-2 text-xs">
        <input aria-label="Lọc ảnh theo ngày" type="date" value={day} onChange={event => setDay(event.target.value)} className="border rounded p-2" />
        <select aria-label="Loại nhận diện" value={kind} onChange={event => setKind(event.target.value)} className="border rounded p-2"><option value="">Tất cả</option><option value="fire">Lửa</option><option value="smoke">Khói</option></select>
        <button disabled={loading} onClick={() => setRefresh(value => value + 1)} className="inline-flex gap-1 items-center border rounded px-2 disabled:opacity-50"><RefreshCcw className="w-3 h-3" />Thử lại</button>
      </div>
    </div>
    <p className="text-[11px] text-slate-500">Ảnh theo bộ lọc ngày và loại nhận diện · Tối đa 100 nhóm mới nhất.</p>
    {error ? <p role="alert" className="text-xs text-red-700">Không tải được lịch sử ảnh: {error}</p>
      : !groups.length ? <p className="text-xs text-slate-500">{loading ? 'Đang tải ảnh...' : 'Không có ảnh phù hợp với bộ lọc.'}</p>
        : <div className="divide-y divide-slate-100">
          {groups.slice(0, visible).map(group => <button key={group.key} onClick={() => open(group)} className="w-full flex gap-3 p-3 text-left hover:bg-slate-50">
            <Photo capture={group.latest} />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-bold">{title(group)} · {types(group.latest)}</p>
              <p className="text-xs text-slate-500">{group.count} ảnh · {date(group.first_at)} – {date(group.last_at)}</p>
              <p className="text-xs text-slate-600">Ảnh mới nhất · Độ tin cậy <strong>{confidence(group.latest)}</strong></p>
              <p className="text-xs text-blue-700">Xem ảnh và thông tin nhận diện</p>
            </div>
          </button>)}
        </div>}
    {visible < groups.length && <button onClick={() => setVisible(value => value + 5)} className="w-full border rounded py-2 text-xs">Xem thêm nhóm</button>}
    {hasMore && <p className="text-xs text-slate-500">Còn nhóm ngoài phạm vi hiển thị. Chọn ngày để thu hẹp kết quả.</p>}

    {selected && current && <div className="fixed inset-0 z-50 bg-slate-950/70 p-4 flex items-center justify-center" onClick={() => setSelected(null)}>
      <div role="dialog" aria-modal="true" aria-labelledby="capture-group-title" onClick={event => event.stopPropagation()} className="bg-white rounded-lg w-full max-w-5xl max-h-[92vh] overflow-y-auto p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div><h3 id="capture-group-title" className="text-sm font-bold">{title(selected)} · {selected.count} ảnh</h3><p className="text-xs text-slate-500">{date(selected.first_at)} – {date(selected.last_at)}</p></div>
          <button aria-label="Đóng chi tiết ảnh" onClick={() => setSelected(null)} className="p-2"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2"><Photo capture={current} large /></div>
          <div className="space-y-3 text-xs">
            <p><strong>Thời điểm:</strong> {date(current.frame_at)}</p>
            <p><strong>Loại nhận diện:</strong> {types(current)}</p>
            <p><strong>Độ tin cậy:</strong> {confidence(current)}</p>
            <p><strong>Số đối tượng:</strong> {current.detections.length}</p>
            <p><strong>Mô hình:</strong> {modelLabel(current.model_name)}</p>
            <p className="text-[10px] text-slate-400">Mã capture: {current.id}</p>
            {current.detections.map((item, index) => <p key={index} className="bg-slate-50 rounded p-2">{label(item.label)} · {(item.confidence * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</p>)}
          </div>
        </div>
        <h4 className="text-xs font-bold">Dòng thời gian ảnh · từ cũ đến mới ({photos.length}/{selected.count})</h4>
        {photoError && <div role="alert" className="text-xs text-red-700">{photoError} <button onClick={() => setPhotoRetry(value => value + 1)} className="underline">Thử lại</button></div>}
        <div className="flex gap-2 overflow-x-auto pb-2">{photos.map(photo => <button key={photo.id} aria-pressed={photo.id === current.id} onClick={() => setCurrent(photo)} className={`shrink-0 border-2 rounded p-1 ${photo.id === current.id ? 'border-blue-500' : 'border-transparent'}`}>
          <Photo capture={photo} /><p className="text-[10px] mt-1">{date(photo.frame_at)}</p>
        </button>)}</div>
        {photoLoading && <p role="status" className="text-xs text-slate-500">Đang tải ảnh...</p>}
        {!photoLoading && !photoError && photos.length < selected.count && <button onClick={() => setOffset(value => value + 100)} className="border rounded px-3 py-2 text-xs">Tải thêm ảnh cũ hơn</button>}
      </div>
    </div>}
  </section>;
};
