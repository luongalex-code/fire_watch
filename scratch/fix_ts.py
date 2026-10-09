import os
import re

# Fix DevicesPage.tsx
file_path_1 = r'C:\Class\IOT\project_final_iot\fe\src\features\firewatch\pages\DevicesPage.tsx'
with open(file_path_1, 'r', encoding='utf-8') as f:
    content_1 = f.read()

content_1 = content_1.replace("import { ConfirmDialog } from '../components/common/ConfirmDialog';", "import { ConfirmDialog } from '../components/common/ConfirmDialog';\nimport { ActuatorCard } from '../components/devices/ActuatorCard';")
content_1 = content_1.replace("measuredAt", "timestamp")

with open(file_path_1, 'w', encoding='utf-8') as f:
    f.write(content_1)

# Fix DeviceControl.tsx
file_path_2 = r'C:\Class\IOT\project_final_iot\fe\src\features\firewatch\components\devices\DeviceControl.tsx'
with open(file_path_2, 'r', encoding='utf-8') as f:
    content_2 = f.read()

content_2 = content_2.replace("measuredAt", "timestamp")

with open(file_path_2, 'w', encoding='utf-8') as f:
    f.write(content_2)
