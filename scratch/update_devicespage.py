import os
import re

file_path = r'C:\Class\IOT\project_final_iot\fe\src\features\firewatch\pages\DevicesPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the grid area with the new ActuatorCards
new_grid = """      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          lastUpdated={latestReading?.measuredAt ? new Date(latestReading.measuredAt).toLocaleTimeString('vi-VN') : undefined}
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
          lastUpdated={latestReading?.measuredAt ? new Date(latestReading.measuredAt).toLocaleTimeString('vi-VN') : undefined}
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
          lastUpdated={latestReading?.measuredAt ? new Date(latestReading.measuredAt).toLocaleTimeString('vi-VN') : undefined}
          onActionClick={handleActionClick}
          pendingTarget={pendingAction?.target === 'led' ? 'led' : null}
        />
      </div>"""

content = re.sub(r'<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">.*?</div>\n\n      <div className="rounded bg-amber-50', new_grid + '\n\n      <div className="rounded bg-amber-50', content, flags=re.DOTALL)

# Add import ActuatorCard
content = content.replace("import { ConfirmDialog } from '../common/ConfirmDialog';", "import { ConfirmDialog } from '../common/ConfirmDialog';\nimport { ActuatorCard } from '../components/devices/ActuatorCard';")

# Make handleActionClick support returning true and set pending target to ID instead of Name if needed.
# Actually I passed target 'Bơm chữa cháy' 'buzzer' 'led' for backwards compat in pendingTarget check.

# Now update the history table format
history_table = """    {
      key: 'requestedAt',
      header: 'Thời gian',
      width: '20%',
      render: (item) => <span className="font-mono text-[11px] text-slate-500">{new Date(item.requestedAt).toLocaleTimeString('vi-VN')}</span>,
    },
    {
      key: 'deviceName',
      header: 'Thiết bị',
      width: '20%',
      render: (item) => <span className="font-bold text-[11px] text-slate-800">{item.deviceName}</span>,
    },
    {
      key: 'commandPayload',
      header: 'Lệnh',
      width: '20%',
      render: (item) => {
        let label = item.commandPayload;
        if (label === 'pump:on') label = 'Bật bơm';
        if (label === 'pump:off') label = 'Tắt bơm';
        if (label === 'buzzer:on') label = 'Bật còi';
        if (label === 'buzzer:off') label = 'Tắt còi';
        if (label === 'led:on') label = 'Bật đèn';
        if (label === 'led:off') label = 'Tắt đèn';
        return (
          <div className="flex flex-col">
            <span className="font-bold text-[11px] text-slate-900">{label}</span>
            <span className="font-mono text-[9px] text-slate-500">{item.commandPayload}</span>
          </div>
        );
      },
    },
    {
      key: 'topic',
      header: 'MQTT Topic',
      width: '20%',
      render: (item) => <span className="font-mono text-[10px] text-slate-400">{item.topic}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '20%',
      render: (item) => {
        const statusMap: Record<string, { label: string, color: string, icon?: string }> = {
          sending: { label: 'Đang gửi', color: 'bg-slate-100 text-slate-600' },
          pending_ack: { label: 'Chờ xác nhận', color: 'bg-amber-100 text-amber-700' },
          ack_success: { label: 'ESP32 đã xác nhận', color: 'bg-emerald-100 text-emerald-700 font-bold', icon: '✓ ' },
          failed: { label: 'Thất bại', color: 'bg-red-100 text-red-700', icon: '! ' },
          timeout: { label: 'Timeout', color: 'bg-red-100 text-red-700', icon: '! ' },
        };
        const config = statusMap[item.status] || { label: item.status, color: 'bg-slate-100 text-slate-700' };
        return (
          <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider ${config.color}`}>
            {config.icon}{config.label}
          </span>
        );
      },
    },"""

content = re.sub(r"    {\n      key: 'requestedAt',\n      header: 'Thời điểm',.*?      },\n    },", history_table, content, flags=re.DOTALL)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
