export interface NavItem {
  id: string;
  label: string;
  path: string;
  iconName:
    | 'LayoutDashboard'
    | 'Camera'
    | 'Radio'
    | 'BellRing'
    | 'Sliders'
    | 'FileSpreadsheet'
    | 'SlidersHorizontal'
    | 'ScrollText';
  badgeKey?: 'unacknowledgedAlerts';
  description?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Tổng quan',
    path: '',
    iconName: 'LayoutDashboard',
    description: 'Trang tổng hợp trạng thái ESP32-S3, camera AI và cảnh báo',
  },
  {
    id: 'camera',
    label: 'Camera & AI',
    path: 'camera',
    iconName: 'Camera',
    description: 'Stream camera, phát hiện lửa/khói và lịch sử capture',
  },
  {
    id: 'sensors',
    label: 'Cảm biến',
    path: 'sensors',
    iconName: 'Radio',
    description: 'Telemetry ESP32-S3: DHT22, Flame ADC thô và MQ-2 ADC thô',
  },
  {
    id: 'alerts',
    label: 'Cảnh báo',
    path: 'alerts',
    iconName: 'BellRing',
    badgeKey: 'unacknowledgedAlerts',
    description: 'Danh sách cảnh báo, tiếp nhận và trạng thái điều kiện',
  },
  {
    id: 'devices',
    label: 'Thiết bị & Điều khiển',
    path: 'devices',
    iconName: 'Sliders',
    description: 'Lệnh MQTT và trạng thái relay bơm, còi, đèn, quạt từ ESP32',
  },
  {
    id: 'reports',
    label: 'Báo cáo',
    path: 'reports',
    iconName: 'FileSpreadsheet',
    description: 'Báo cáo cảnh báo từ dữ liệu thật trong database',
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
    description: 'Audit thao tác, lệnh điều khiển và sự kiện hệ thống',
  },
];
