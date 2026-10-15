import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acknowledgementLabel, conditionLabel, confirmationLabel, reportDateBounds, reportStats, severityLabel } from './alertReport.ts';

const alert = (overrides = {}) => ({
  id: '1505', source: 'ai', status: 'new', severity: 'critical', backendSeverity: 'high',
  isActive: true, conditionStatus: 'cleared', ...overrides,
});

test('active count follows backend condition, not unacknowledged status', () => {
  const rows = Array.from({ length: 100 }, (_, id) => alert({ id: String(id), conditionStatus: id === 0 ? 'active' : 'cleared' }));
  const stats = reportStats(rows);
  assert.equal(stats.total, 100);
  assert.equal(stats.active, 1);
  assert.equal(stats.cleared, 99);
  assert.equal(stats.unacknowledged, 100);
  assert.equal(stats.active, rows.filter(row => conditionLabel(row) === 'Đang còn điều kiện').length);
});

test('acknowledgement and cleared condition remain independent', () => {
  assert.equal(acknowledgementLabel(alert()), 'Chưa tiếp nhận');
  assert.equal(conditionLabel(alert()), 'Đã hết điều kiện');
  assert.equal(acknowledgementLabel(alert({ status: 'acknowledged' })), 'Đã tiếp nhận');
  assert.equal(acknowledgementLabel(alert({ status: 'resolved', acknowledgedAt: '14/10/2026 16:00' })), 'Đã tiếp nhận');
});

test('single-source priority is not reinterpreted as confirmed fire', () => {
  assert.equal(severityLabel(alert()), 'Cao');
  assert.equal(severityLabel(alert({ backendSeverity: 'critical' })), 'Nghiêm trọng');
  assert.equal(confirmationLabel(alert()), 'Phát hiện đơn nguồn');
  assert.equal(confirmationLabel(alert({ source: 'sensor' })), 'Phát hiện đơn nguồn');
});

test('date filters use inclusive local days with exclusive next-day bound', () => {
  assert.deepEqual(reportDateBounds('2026-10-14', '2026-10-14'), {
    startedFrom: '2026-10-14T00:00:00+07:00', startedBefore: '2026-10-14T17:00:00.000Z',
  });
  assert.deepEqual(reportDateBounds('', ''), { startedFrom: undefined, startedBefore: undefined });
});

test('empty and unknown condition counts are explicit', () => {
  assert.equal(reportStats([]).total, 0);
  const stats = reportStats([alert({ conditionStatus: 'unknown' })]);
  assert.equal(stats.active, 0);
  assert.equal(stats.cleared, 0);
  assert.equal(stats.unknown, 1);
});
