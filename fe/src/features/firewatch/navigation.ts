export interface NavItem {
  id: string;
  label: string;
  path: string;
  iconName: 'LayoutDashboard' | 'Camera' | 'Radio' | 'BellRing' | 'Sliders' | 'FileSpreadsheet' | 'SlidersHorizontal' | 'ScrollText';
  badgeKey?: 'unacknowledgedAlerts';
  description?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Tổng quan',
    path: '',
    iconName: 'LayoutDashboard',
    description: 'Trang tong hop trang thai ESP32-S3, camera AI va cảnh báo',
  },
  {
    id: 'camera',
    label: 'Camera & AI',
    path: 'camera',
    iconName: 'Camera',
    description: 'Stream camera, phát hiện lửa/khói va lich su capture',
  },
  {
    id: 'sensors',
    label: 'Cảm biến',
    path: 'sensors',
    iconName: 'Radio',
    description: 'Telemetry ESP32-S3: DHT22, Flame ADC thô',
  },
  {
    id: 'alerts',
    label: 'Cảnh báo',
    path: 'alerts',
    iconName: 'BellRing',
    badgeKey: 'unacknowledgedAlerts',
    description: 'Danh sach cảnh báo, tiep nhan va trang thai điều kiện',
  },
  {
    id: 'devices',
    label: 'Thiết bị & Dieu khien',
    path: 'devices',
    iconName: 'Sliders',
    description: 'Lenh MQTT va trang thai relay bom, coi, den tu ESP32',
  },
  {
    id: 'reports',
    label: 'Báo cáo & CSV',
    path: 'reports',
    iconName: 'FileSpreadsheet',
    description: 'Báo cáo cảnh báo tu du lieu thật trong database',
  },
  {
    id: 'settings',
    label: 'Cấu hình hệ thống',
    path: 'settings',
    iconName: 'SlidersHorizontal',
    description: 'Ngưỡng AI, ngưỡng cảm biến và liên động gửi lên backend',
  },
  {
    id: 'logs',
    label: 'Nhật ký hệ thống',
    path: 'logs',
    iconName: 'ScrollText',
    description: 'Audit thao tac, lenh điều khiển va sự kiện hệ thống',
  },
];
