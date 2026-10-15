import type { AuditLog, LogLevel } from '../types/index.ts';

export interface LogEvent {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: string;
  title: string;
  location: string;
  result: string;
  records: AuditLog[];
  timeline: { label: string; timestamp?: string }[];
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const targets: Record<string, string> = {
  pump: 'bơm chữa cháy', fan: 'quạt hút', buzzer: 'còi báo động', led: 'đèn cảnh báo', lcd: 'LCD', mode: 'chế độ vận hành',
};
const actions: Record<string, string> = {
  on: 'Bật', off: 'Tắt', toggle: 'Đổi trạng thái', clear: 'Xóa nội dung',
  reset: 'Đặt lại', silence: 'Tắt âm', auto: 'Chuyển tự động', manual: 'Chuyển thủ công',
};
const labels: Record<string, string> = {
  alert_acknowledged: 'Tiếp nhận cảnh báo', alert_created: 'Cảnh báo mới', alert_resolved: 'Cảnh báo kết thúc',
  config_updated: 'Cập nhật cấu hình', device_connected: 'Thiết bị kết nối', device_disconnected: 'Thiết bị mất kết nối',
};
const commandChannels = new Set(['command_created', 'mqtt_command_sent', 'command_acknowledged']);

export function groupLogEvents(logs: AuditLog[]): LogEvent[] {
  const groups = new Map<string, AuditLog[]>();
  for (const log of logs) {
    const uuid = text(log.details?.command_uuid) || (log.source === 'command' ? log.entityId || '' : '');
    const key = uuid && (log.source === 'command' || commandChannels.has(log.channel || '')) ? `command:${uuid}` : `log:${log.id}`;
    groups.set(key, [...(groups.get(key) || []), log]);
  }
  return [...groups.entries()].map(([id, records]): LogEvent => {
    records.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || Number(a.id) - Number(b.id));
    const latest = records[records.length - 1];
    const context = [...records].reverse().find(row => row.device || row.areaName) || latest;
    const details = Object.assign({}, ...records.map(row => row.details || {}));
    const location = [context.device || context.deviceName, context.areaName].filter(Boolean).join(' · ') || 'Chưa xác định';
    if (!id.startsWith('command:')) {
      const category = latest.source === 'alert' || latest.channel?.startsWith('alert_') ? 'Cảnh báo'
        : latest.channel?.includes('config') || latest.source === 'settings' ? 'Cấu hình'
          : latest.source === 'device' || latest.channel?.startsWith('device_') ? 'Thiết bị' : 'Hệ thống';
      return { id, records, location, timestamp: latest.timestamp, level: latest.level, category,
        title: labels[latest.channel || ''] || latest.message || 'Sự kiện hệ thống',
        result: latest.channel === 'alert_acknowledged' ? 'Đã tiếp nhận' : 'Đã ghi nhận', timeline: [] };
    }
    const command = object(details.command);
    const ackRecord = [...records].reverse().find(row => row.channel === 'command_acknowledged');
    const snapshotAck = object(command.ack_payload);
    const ack = Object.keys(snapshotAck).length ? snapshotAck : object(ackRecord?.details?.ack_payload);
    const ackStatus = text(ack.status).toLowerCase();
    const hasAck = Boolean(ackRecord || command.acknowledged_at || Object.keys(ack).length);
    const failed = ackStatus === 'failed' || ackStatus === 'rejected' || (!hasAck && command.status === 'failed');
    const timedOut = !hasAck && command.status === 'timeout';
    const result = failed ? 'Không áp dụng' : ackStatus === 'acknowledged' ? 'Đã áp dụng'
      : hasAck ? 'Đã phản hồi ACK' : timedOut ? 'Hết thời gian chờ ACK' : 'Chưa có ACK';
    const stageTime = (channel: string, field: string) => text(command[field]) || records.find(row => row.channel === channel)?.timestamp;
    return {
      id, records, location, timestamp: latest.timestamp, category: 'Thiết bị',
      level: failed || timedOut ? 'ERROR' : latest.level,
      title: `${actions[text(details.action)] || text(details.action) || 'Điều khiển'} ${targets[text(details.target)] || text(details.target) || 'thiết bị'}`,
      result,
      timeline: [
        { label: 'Backend tạo lệnh', timestamp: stageTime('command_created', 'requested_at') },
        { label: 'Gửi lệnh qua MQTT', timestamp: stageTime('mqtt_command_sent', 'sent_at') },
        { label: `ESP32 phản hồi — ${result}`, timestamp: stageTime('command_acknowledged', 'acknowledged_at') },
      ],
    };
  }).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export function filterLogEvents(events: LogEvent[], level: string, category: string, query: string): LogEvent[] {
  const search = query.trim().toLocaleLowerCase('vi');
  return events.filter(event => (level === 'ALL' || event.level === level)
    && (category === 'ALL' || event.category === category)
    && (!search || `${event.title} ${event.location} ${event.result} ${JSON.stringify(event.records)}`.toLocaleLowerCase('vi').includes(search)));
}
