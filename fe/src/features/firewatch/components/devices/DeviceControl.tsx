import React, { useState } from 'react';
import { Bell, Power, Sliders, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../common/ConfirmDialog';
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

      <div className="grid grid-cols-1 gap-2.5 text-xs">
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Power className="w-4 h-4 text-red-600" />
              Bơm chữa cháy - relay GPIO16
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Trạng thái ESP32 báo về: <strong>{stateText(latestReading?.pumpRelayState, isStale)}</strong>
            </div>
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
                  'Lenh se gửi qua backend/MQTT den ESP32. Trạng thái chi duoc xác nhận khi ESP32 phan hoi ACK.',
                  true
                )
              }
              className="px-2.5 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
            >
              ON
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
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded disabled:opacity-50"
            >
              OFF
            </button>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Bell className="w-4 h-4 text-red-600" />
              Còi báo động GPIO7
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Trạng thái ESP32 báo về: <strong>{stateText(latestReading?.buzzerState, isStale)}</strong>
            </div>
          </div>
          <div className="flex gap-2">
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
              className="px-2.5 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
            >
              ON
            </button>
            <button
              disabled={isOffline}
              onClick={() =>
                handleActionClick(
                  'buzzer',
                  7,
                  'buzzer:off',
                  'Gửi yêu cầu tat coi',
                  'Tiếp nhận hoặc tat coi khong lam het điều kiện cảnh báo.',
                  false
                )
              }
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded disabled:opacity-50"
            >
              OFF
            </button>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Zap className="w-4 h-4 text-amber-500" />
              Đèn cảnh báo GPIO2
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Trạng thái ESP32 báo về: <strong>{stateText(latestReading?.ledState, isStale)}</strong>
            </div>
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
              className="px-2.5 py-1 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded disabled:opacity-50"
            >
              ON
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
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded disabled:opacity-50"
            >
              OFF
            </button>
          </div>
        </div>
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
