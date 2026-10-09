import os
import re

file_path = r'C:\Class\IOT\project_final_iot\fe\src\features\firewatch\components\devices\DeviceControl.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the inner grid with the ActuatorCards
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

content = re.sub(r'<div className="grid grid-cols-1 gap-2.5 text-xs">.*?</div>\n\n      <div className="rounded bg-amber-50', new_grid + '\n\n      <div className="rounded bg-amber-50', content, flags=re.DOTALL)

# Also import ActuatorCard
content = content.replace("import { ConfirmDialog } from '../common/ConfirmDialog';", "import { ConfirmDialog } from '../common/ConfirmDialog';\nimport { ActuatorCard } from './ActuatorCard';")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
