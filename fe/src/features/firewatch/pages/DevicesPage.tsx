import React, { useEffect, useState } from 'react';
import { Bell, Cpu, Download, Power, Wind, Zap } from 'lucide-react';
import { useFireWatch } from '../hooks/useFireWatch';
import { DeviceCommand } from '../types';
import { fireWatchService } from '../services';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ActuatorCard } from '../components/devices/ActuatorCard';
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
          pending_ack: 'Chờ thiết bị xác nhận',
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ActuatorCard
          id="pump"
          name="Bơm chữa cháy"
          gpio={16}
          icon={<Power className="w-5 h-5 text-red-600" />}
          currentState={latestReading?.pumpRelayState ?? null}
          isStale={isStale}
          isOffline={isOffline}
          onCommand="pump:on"
          offCommand="pump:off"
          onLabel="Bật bơm"
          offLabel="Tắt bơm"
          descOn="Bật bơm chữa cháy. Cần kiểm tra nguồn nước trước khi sử dụng."
          descOff="Tắt bơm. Cảnh báo cháy vẫn được theo dõi."
          colorScheme="red"
          lastUpdated={latestReading?.timestamp ? new Date(latestReading.timestamp).toLocaleTimeString('vi-VN') : undefined}
          onActionClick={handleActionClick}
          pendingTarget={pendingAction?.target === 'Bơm chữa cháy' ? 'pump' : null}
        />
        <ActuatorCard
          id="fan"
          name="Quạt hút khói/khí ga"
          gpio={15}
          icon={<Wind className="w-5 h-5 text-orange-600" />}
          currentState={latestReading?.fanState ?? null}
          isStale={isStale}
          isOffline={isOffline}
          onCommand="fan:on"
          offCommand="fan:off"
          onLabel="Bật quạt"
          offLabel="Tắt quạt"
          descOn="Bật quạt hút khói và khí ga."
          descOff="Tắt quạt. Hệ thống vẫn tiếp tục theo dõi khói và khí ga."
          colorScheme="amber"
          lastUpdated={latestReading?.timestamp ? new Date(latestReading.timestamp).toLocaleTimeString('vi-VN') : undefined}
          onActionClick={handleActionClick}
          pendingTarget={pendingAction?.target === 'fan' ? 'fan' : null}
        />
        <ActuatorCard
          id="buzzer"
          name="Còi báo động"
          gpio={7}
          icon={<Bell className="w-5 h-5 text-red-600" />}
          currentState={latestReading?.buzzerState ?? null}
          isStale={isStale}
          isOffline={isOffline}
          onCommand="buzzer:on"
          offCommand="buzzer:off"
          onLabel="Bật còi"
          offLabel="Tắt còi"
          descOn="Bật còi báo động."
          descOff="Tắt còi. Cảnh báo cháy vẫn được theo dõi."
          colorScheme="red"
          lastUpdated={latestReading?.timestamp ? new Date(latestReading.timestamp).toLocaleTimeString('vi-VN') : undefined}
          onActionClick={handleActionClick}
          pendingTarget={pendingAction?.target === 'buzzer' ? 'buzzer' : null}
        />
        <ActuatorCard
          id="led"
          name="Đèn cảnh báo"
          gpio={2}
          icon={<Zap className="w-5 h-5 text-amber-500" />}
          currentState={latestReading?.ledState ?? null}
          isStale={isStale}
          isOffline={isOffline}
          onCommand="led:on"
          offCommand="led:off"
          onLabel="Bật đèn"
          offLabel="Tắt đèn"
          descOn="Bật đèn cảnh báo."
          descOff="Tắt đèn. Cảnh báo cháy vẫn được theo dõi."
          colorScheme="amber"
          lastUpdated={latestReading?.timestamp ? new Date(latestReading.timestamp).toLocaleTimeString('vi-VN') : undefined}
          onActionClick={handleActionClick}
          pendingTarget={pendingAction?.target === 'led' ? 'led' : null}
        />
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
