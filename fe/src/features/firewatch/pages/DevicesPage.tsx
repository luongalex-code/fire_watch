import React, { useEffect, useState } from 'react';
import { Bell, Cpu, Download, Power, Zap } from 'lucide-react';
import { useFireWatch } from '../hooks/useFireWatch';
import { DeviceCommand } from '../types';
import { fireWatchService } from '../services';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { DataTable, Column } from '../components/common/DataTable';
import { exportToCsv } from '../utils/exportCsv';

const outputState = (value: boolean | null | undefined, stale: boolean) => {
  if (stale || value === null || value === undefined) return 'Chưa có dữ liệu';
  return value ? 'ON' : 'OFF';
};

export const DevicesPage: React.FC = () => {
  const { latestReading, systemStatus, sendDeviceCommand } = useFireWatch();
  const [commands, setCommands] = useState<DeviceCommand[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    target: string;
    gpio: number;
    payload: string;
    title: string;
    desc: string;
    isDestructive?: boolean;
  } | null>(null);

  const isOffline = systemStatus.esp32 === 'disconnected';
  const isStale = isOffline || Boolean(latestReading?.isStale);

  useEffect(() => {
    let mounted = true;
    fireWatchService.getCommandHistory().then((data) => {
      if (mounted) setCommands(data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleActionClick = (
    target: string,
    gpio: number,
    payload: string,
    title: string,
    desc: string,
    isDestructive = false
  ) => {
    if (isOffline) return;
    setPendingAction({ target, gpio, payload, title, desc, isDestructive });
    setIsConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;
    try {
      const result = await sendDeviceCommand(
        pendingAction.target,
        pendingAction.gpio,
        pendingAction.payload
      );
      setCommands((prev) => [result, ...prev]);
    } finally {
      setIsConfirmOpen(false);
      setPendingAction(null);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Thời gian', 'Thiết bị', 'Payload', 'Topic', 'ACK latency', 'Trạng thái', 'Nguoi gửi'];
    const rows = commands.map((command) => [
      command.timestamp,
      command.targetDevice,
      command.commandPayload,
      command.topic,
      command.ackLatencyMs ? `${command.ackLatencyMs} ms` : '',
      command.status,
      command.operator,
    ]);
    exportToCsv(`fire_watch_commands_${Date.now()}.csv`, headers, rows);
  };

  const commandColumns: Column<DeviceCommand>[] = [
    {
      key: 'timestamp',
      header: 'Thời gian',
      width: '16%',
      render: (item) => <span className="font-mono text-[11px] text-slate-800">{item.timestamp}</span>,
    },
    {
      key: 'targetDevice',
      header: 'Thiết bị',
      width: '18%',
      render: (item) => <span className="font-semibold text-slate-900">{item.targetDevice}</span>,
    },
    {
      key: 'commandPayload',
      header: 'Payload',
      width: '16%',
      render: (item) => <span className="font-mono text-[11px] text-blue-700">{item.commandPayload}</span>,
    },
    {
      key: 'topic',
      header: 'MQTT topic',
      width: '22%',
      render: (item) => <span className="font-mono text-[10px] text-slate-500">{item.topic}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '16%',
      render: (item) => {
        const label: Record<string, string> = {
          sending: 'Dang gửi',
          pending_ack: 'Cho ESP32 ACK',
          ack_success: 'ESP32 da xác nhận',
          failed: 'That bai',
          timeout: 'Timeout',
        };
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border bg-slate-100 text-slate-700">
            {label[item.status] || item.status}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Thiết bị & điều khiển</h2>
              <p className="text-xs text-slate-500">
                Lệnh điều khiển di qua backend/MQTT va chi duoc xem la xác nhận khi ESP32 phan hoi ACK.
              </p>
            </div>
          </div>
          <span
            className={`px-2 py-1 rounded text-xs font-bold ${
              isOffline ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {isOffline ? 'ESP32 mất kết nối' : 'ESP32 dang ket noi'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Power className="w-4 h-4 text-red-600" />
            Bơm chữa cháy GPIO16
          </div>
          <div className="text-sm text-slate-600">
            Trạng thái ESP32 báo về: <strong>{outputState(latestReading?.pumpRelayState, isStale)}</strong>
          </div>
          <div className="flex gap-2">
            <button
              disabled={isOffline}
              onClick={() =>
                handleActionClick(
                  'Bơm chữa cháy',
                  16,
                  'pump:on',
                  'Gửi yêu cầu bật bơm',
                  'Backend se gửi MQTT pump:on den ESP32. Relay ON không chứng minh bơm có nước.',
                  true
                )
              }
              className="flex-1 rounded bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Gửi ON
            </button>
            <button
              disabled={isOffline}
              onClick={() =>
                handleActionClick(
                  'Bơm chữa cháy',
                  16,
                  'pump:off',
                  'Gửi yêu cầu tat bom',
                  'Lenh tat bom khong dong nghia điều kiện cảnh báo da het.',
                  true
                )
              }
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Gửi OFF
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Bell className="w-4 h-4 text-red-600" />
            Còi báo động GPIO7
          </div>
          <div className="text-sm text-slate-600">
            Trạng thái ESP32 báo về: <strong>{outputState(latestReading?.buzzerState, isStale)}</strong>
          </div>
          <button
            disabled={isOffline}
            onClick={() =>
              handleActionClick(
                'buzzer',
                7,
                'buzzer:on',
                'Gửi yêu cầu bat coi',
                'Lenh thu cong rieng qua backend/MQTT. Firmware van co the điều khiển coi theo trang thai chua chay.',
                true
              )
            }
            className="w-full rounded bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            Gửi bật còi
          </button>
          <button
            disabled={isOffline}
            onClick={() =>
              handleActionClick(
                'buzzer',
                7,
                'buzzer:off',
                'Gửi yêu cầu tat coi',
                'Tat coi khong lam het điều kiện cảnh báo.',
                false
              )
            }
            className="w-full rounded border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Gửi tắt còi
          </button>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Zap className="w-4 h-4 text-amber-500" />
            Đèn cảnh báo GPIO2
          </div>
          <div className="text-sm text-slate-600">
            Trạng thái ESP32 báo về: <strong>{outputState(latestReading?.ledState, isStale)}</strong>
          </div>
          <div className="flex gap-2">
            <button
              disabled={isOffline}
              onClick={() =>
                handleActionClick(
                  'led',
                  2,
                  'led:on',
                  'Gửi yêu cầu bat den',
                  'Lenh thu cong rieng qua backend/MQTT. Trạng thái chi xác nhận khi ESP32 ACK va telemetry bao lai.',
                  true
                )
              }
              className="flex-1 rounded bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              Gửi ON
            </button>
            <button
              disabled={isOffline}
              onClick={() =>
                handleActionClick(
                  'led',
                  2,
                  'led:off',
                  'Gửi yêu cầu tat den',
                  'Tat den khong lam het điều kiện cảnh báo va khong anh huong luong tu dong.',
                  false
                )
              }
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Gửi OFF
            </button>
          </div>
          <div className="text-xs text-slate-500">
            Co the điều khiển thu cong trong tinh huong khan cap; firmware van giu luong tu dong theo trang thai cảnh báo.
          </div>
        </div>
      </div>

      <div className="rounded bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
        Relay ON là trạng thái điều khiển đầu ra do ESP32 báo về. Hệ thống không có cảm biến lưu lượng/áp lực nước nên không kết luận bơm có nước.
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Lịch sử lenh điều khiển
          </h3>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất CSV</span>
          </button>
        </div>

        <DataTable
          columns={commandColumns}
          data={commands}
          keyExtractor={(item) => item.id}
          emptyMessage="Chưa có lenh điều khiển nao duoc ghi nhan"
        />
      </div>

      {pendingAction && (
        <ConfirmDialog
          isOpen={isConfirmOpen}
          title={pendingAction.title}
          message={pendingAction.desc}
          isDestructive={pendingAction.isDestructive}
          onConfirm={handleConfirm}
          onCancel={() => {
            setIsConfirmOpen(false);
            setPendingAction(null);
          }}
        />
      )}
    </div>
  );
};
