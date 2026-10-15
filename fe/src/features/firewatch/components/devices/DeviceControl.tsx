import React from 'react';
import { Bell, Power, Sliders, Wind, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFireWatch } from '../../hooks/useFireWatch';

interface DeviceControlWidgetProps {
  showLinkToDetails?: boolean;
}

export const DeviceControlWidget: React.FC<DeviceControlWidgetProps> = ({
  showLinkToDetails = true,
}) => {
  const { latestReading, systemStatus } = useFireWatch();
  const isOffline = systemStatus.esp32 === 'disconnected';
  const isStale = isOffline || Boolean(latestReading?.isStale);

  const getStatusDisplay = (value: boolean | null | undefined) => {
    if (isOffline) {
      return { text: 'Không thể xác định trạng thái hiện tại', className: 'bg-slate-100 text-slate-500' };
    }
    if (isStale || value === null || value === undefined) {
      return { text: 'Không rõ', className: 'bg-slate-100 text-slate-500' };
    }
    return value 
      ? { text: 'Đang bật', className: 'bg-emerald-100 text-emerald-700' }
      : { text: 'Đang tắt', className: 'bg-slate-100 text-slate-700' };
  };

  const devices = [
    {
      id: 'pump',
      name: 'Bơm chữa cháy',
      gpio: 16,
      icon: <Power className="w-5 h-5 text-red-600" />,
      state: latestReading?.pumpRelayState,
    },
    {
      id: 'fan',
      name: 'Quạt hút khói/khí ga',
      gpio: 15,
      icon: <Wind className="w-5 h-5 text-orange-600" />,
      state: latestReading?.fanState,
    },
    {
      id: 'buzzer',
      name: 'Còi báo động',
      gpio: 17,
      icon: <Bell className="w-5 h-5 text-red-600" />,
      state: latestReading?.buzzerState,
    },
    {
      id: 'led',
      name: 'Đèn cảnh báo',
      gpio: 2,
      icon: <Zap className="w-5 h-5 text-amber-500" />,
      state: latestReading?.ledState,
    }
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm font-bold text-slate-900">Thiết bị chấp hành</h3>
        </div>
        <span
          className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
            isOffline ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {isOffline ? 'Mất kết nối' : 'Đã kết nối'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {devices.map((dev) => {
          const status = getStatusDisplay(dev.state);
          return (
            <div key={dev.id} className="border border-slate-200 rounded-lg p-3 flex flex-col items-center justify-center text-center gap-2 bg-slate-50">
              <div className="p-2 bg-white rounded-full shadow-sm border border-slate-100">
                {dev.icon}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">{dev.name}</div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">GPIO{dev.gpio}</div>
              </div>
              <div className={`mt-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${status.className}`}>
                {status.text}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-800">
        Đây là trạng thái điều khiển relay/đầu ra. Relay ON không chứng minh bơm có nước hoặc có áp lực.
      </div>

      {showLinkToDetails && (
        <Link
          to="/devices"
          className="w-full mt-1 py-2 text-center text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition"
        >
          Tới trang Thiết bị &amp; điều khiển
        </Link>
      )}
    </div>
  );
};
