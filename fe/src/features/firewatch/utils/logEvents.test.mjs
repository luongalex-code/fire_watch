import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterLogEvents, groupLogEvents } from './logEvents.ts';

const log = (id, channel, details = {}, extra = {}) => ({
  id: String(id), timestamp: `2026-10-14T09:07:${String(id).padStart(2, '0')}Z`,
  source: 'command', level: 'INFO', channel, message: channel,
  device: 'esp32-s3-01', areaName: 'Area A',
  details: { command_uuid: 'same-command', target: 'lcd', action: 'clear', ...details }, ...extra,
});

test('groups a command lifecycle and keeps raw records and timeline', () => {
  const events = groupLogEvents([
    log(3, 'command_acknowledged', { ack_payload: { status: 'acknowledged' } }),
    log(1, 'command_created'), log(2, 'mqtt_command_sent'),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].records.length, 3);
  assert.equal(events[0].result, 'Đã áp dụng');
  assert.equal(events[0].location, 'esp32-s3-01 · Area A');
  assert.equal(events[0].title, 'Xóa nội dung LCD');
  assert.ok(events[0].timeline.every(stage => stage.timestamp));
});

test('failed ACK overrides misleading acknowledged command status', () => {
  const [event] = groupLogEvents([log(1, 'command_acknowledged', {
    command: { status: 'acknowledged', ack_payload: { status: 'failed' } },
  })]);
  assert.equal(event.result, 'Không áp dụng');
  assert.equal(event.level, 'ERROR');
});

test('unknown ACK and missing ACK do not claim the action was applied', () => {
  assert.equal(groupLogEvents([log(1, 'command_acknowledged')])[0].result, 'Đã phản hồi ACK');
  assert.equal(groupLogEvents([log(1, 'command_created', { command: { status: 'acknowledged' } })])[0].result, 'Chưa có ACK');
});

test('command snapshot supplies stages outside the raw log limit', () => {
  const [event] = groupLogEvents([log(3, 'command_acknowledged', { command: {
    requested_at: '2026-10-14T09:07:01Z', sent_at: '2026-10-14T09:07:02Z',
    acknowledged_at: '2026-10-14T09:07:03Z', ack_payload: { status: 'acknowledged' },
  } })]);
  assert.ok(event.timeline.every(stage => stage.timestamp));
});

test('level, category and search filter grouped events independently', () => {
  const events = groupLogEvents([
    log(1, 'command_created'),
    log(2, 'alert_acknowledged', {}, { source: 'alert', level: 'AUDIT', entityId: '1497' }),
  ]);
  assert.equal(events.length, 2);
  assert.equal(filterLogEvents(events, 'AUDIT', 'Cảnh báo', '').length, 1);
  assert.equal(filterLogEvents(events, 'AUDIT', 'Thiết bị', '').length, 0);
  assert.equal(filterLogEvents(events, 'ALL', 'Thiết bị', 'LCD').length, 1);
  assert.equal(filterLogEvents(events, 'ALL', 'ALL', 'missing').length, 0);
  assert.deepEqual(groupLogEvents([]), []);
});
