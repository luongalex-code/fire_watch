import type { AlertEvent } from '../types/index.ts';

export const acknowledgementLabel = (alert: AlertEvent) =>
  alert.acknowledgedAt || alert.status === 'acknowledged' ? 'Đã tiếp nhận' : 'Chưa tiếp nhận';

export const conditionLabel = (alert: AlertEvent) => alert.conditionStatus === 'active' ? 'Đang còn điều kiện'
  : alert.conditionStatus === 'cleared' ? 'Đã hết điều kiện' : 'Chưa rõ';

export const sourceLabel = (alert: AlertEvent) => alert.source === 'ai' ? 'Camera AI'
  : alert.source === 'sensor' ? 'Cảm biến ESP32' : alert.source === 'dual' ? 'Hai nguồn' : 'Hệ thống';

// Severity is urgency, not evidence that both independent sources confirmed fire.
export const severityLabel = (alert: AlertEvent) => {
  const labels: Record<string, string> = { critical: 'Nghiêm trọng', high: 'Cao', medium: 'Trung bình', low: 'Thấp', warning: 'Cảnh báo', info: 'Thông tin', audit: 'Thao tác' };
  return labels[alert.backendSeverity || alert.severity] || 'Chưa rõ';
};

export const confirmationLabel = (alert: AlertEvent) => alert.source === 'ai' || alert.source === 'sensor'
  ? 'Phát hiện đơn nguồn' : alert.source === 'dual' ? 'Backend xác nhận kép' : 'Không áp dụng';

export function reportStats(alerts: AlertEvent[]) {
  return {
    total: alerts.length,
    unacknowledged: alerts.filter(alert => acknowledgementLabel(alert) === 'Chưa tiếp nhận').length,
    acknowledged: alerts.filter(alert => acknowledgementLabel(alert) === 'Đã tiếp nhận').length,
    active: alerts.filter(alert => alert.conditionStatus === 'active').length,
    cleared: alerts.filter(alert => alert.conditionStatus === 'cleared').length,
    unknown: alerts.filter(alert => alert.conditionStatus === 'unknown').length,
  };
}

export function reportDateBounds(from: string, to: string) {
  const nextDay = to ? new Date(`${to}T00:00:00+07:00`) : null;
  if (nextDay) nextDay.setTime(nextDay.getTime() + 24 * 60 * 60 * 1000);
  return { startedFrom: from ? `${from}T00:00:00+07:00` : undefined, startedBefore: nextDay?.toISOString() };
}
