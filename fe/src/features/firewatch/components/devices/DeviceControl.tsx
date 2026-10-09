import React, { useState } from 'react';
import { Bell, Power, Sliders, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ActuatorCard } from './ActuatorCard';
import { useFireWatch } from '../../hooks/useFireWatch';

interface DeviceControlWidgetProps {
  showLinkToDetails?: boolean;
}

const stateText = (value: boolean | null | undefined, stale: boolean) => {
  if (stale || value === null || value === undefined) return 'Chưa có dữ liệu';
  return value ? 'ON' : 'OFF';
};

export const DeviceControlWidget: React.FC<DeviceControlWidgetProps> = ({
  showLinkToDetails = true,
}) => {
  const { latestReading, sendDeviceCommand, systemStatus } = useFireWatch();
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
      await sendDeviceCommand(pendingAction.target, pendingAction.gpio, pendingAction.payload);
    } finally {
      setIsConfirmOpen(false);
      setPendingAction(null);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm font-bold text-slate-900">Thiết bị chap hanh</h3>
        </div>
        <span
          className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
            isOffline ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {isOffline ? 'ESP32 offline' : 'MQTT command'}
        </span>
      </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          descOn="Lệnh sẽ được gửi qua backend/MQTT đến ESP32. Relay ON không chứng minh bơm có nước."
          descOff="Lệnh tắt bơm không đồng nghĩa điều kiện cảnh báo đã hết."
          colorScheme="red"
          lastUpdated={latestReading?.timestamp ? new Date(latestReading.timestamp).toLocaleTimeString('vi-VN') : undefined}
          onActionClick={handleActionClick}
          pendingTarget={pendingAction?.target === 'Bơm chữa cháy' ? 'pump' : null}
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
          descOn="Lệnh thủ công qua backend/MQTT. Còi vẫn có thể bị điều khiển tự động bởi trạng thái cháy."
          descOff="Tiếp nhận hoặc tắt còi không làm mất đi trạng thái cháy."
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
          descOn="Lệnh thủ công. Trạng thái chỉ xác nhận khi ESP32 ACK."
          descOff="Tắt đèn không làm mất cảnh báo và không ảnh hưởng luồng tự động."
          colorScheme="amber"
          lastUpdated={latestReading?.timestamp ? new Date(latestReading.timestamp).toLocaleTimeString('vi-VN') : undefined}
          onActionClick={handleActionClick}
          pendingTarget={pendingAction?.target === 'led' ? 'led' : null}
        />
      </div>

      <div className="rounded bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-800">
        Đây là trang thai điều khiển relay/đầu ra. Relay ON không chứng minh bơm có nước hoặc có áp lực.
      </div>

      {showLinkToDetails && (
        <Link
          to="/devices"
          className="w-full mt-1 py-2 text-center text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition"
        >
          Tới trang thiết bị & điều khiển
        </Link>
      )}

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
