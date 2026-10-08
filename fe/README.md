# FireWatch - Hệ thống Giám sát Hỗ trợ Chữa cháy Công nghiệp

> **Đề tài:** “Thiết kế và xây dựng hệ thống giám sát hỗ trợ chữa cháy”.  
> Hệ thống kết hợp thị giác máy tính suy luận tại biên (YOLOv8 NPU Edge) và vi điều khiển IoT (ESP32-S3 Telemetry) phục vụ trung tâm chỉ huy điều hành tác chiến và hồ sơ kiểm định an toàn PCCC tiêu chuẩn IEC 61508 / SIL-2.

---

## 1. Cài đặt và Khởi chạy

### Yêu cầu môi trường
- **Node.js**: >= 18.x
- **Trình quản lý gói**: npm hoặc yarn / pnpm

### Các bước khởi chạy:
```bash
# 1. Cài đặt các thư viện phụ thuộc
npm install

# 2. Khởi chạy máy chủ phát triển (Dev server)
npm run dev
```
Ứng dụng sẽ chạy mặc định tại cổng `http://localhost:3000`.

---

## 2. Biên dịch Production (Build)

```bash
# Kiểm tra TypeScript và đóng gói ứng dụng
npm run build

# Chạy bản thử nghiệm đã build
npm run preview
```

---

## 3. Cấu trúc Thư mục Dự án

```
public/
  assets/
src/
  main.tsx                              # Entry point chính React DOM
  App.tsx                               # Bọc BrowserRouter và mount FireWatchApp
  index.css                             # Cấu hình Tailwind CSS, Inter & JetBrains Mono
  features/
    firewatch/
      index.ts                          # Export công khai module FireWatchApp
      FireWatchApp.tsx                  # Khai báo tuyến Routes & Provider
      firewatch.css                     # CSS scoped cho module
      navigation.ts                     # Định nghĩa duy nhất 8 mục menu Sidebar
      context/
        FireWatchProvider.tsx           # Context quản lý trạng thái, cảnh báo, telemetry
      layouts/
        AppLayout.tsx                   # Layout duy nhất: Header, Sidebar, Banner, Outlet
        Sidebar.tsx                     # 8 mục menu, thu gọn desktop, drawer mobile
        Header.tsx                      # Chọn khu vực, trạng thái S3/CAM/AI/MQTT, clock
        DemoScenarioBar.tsx             # Chuyển đổi 9 kịch bản mô phỏng
        GlobalAlertBanner.tsx           # Banner cảnh báo đỏ mức cao thời gian thực
      pages/
        OverviewPage.tsx                # Trang 1: Tổng quan tác chiến
        CameraAIPage.tsx                # Trang 2: Camera & AI YOLO (Live + Benchmark)
        SensorsPage.tsx                 # Trang 3: Cảm biến môi trường & Telemetry
        AlertsPage.tsx                  # Trang 4: Cảnh báo & Sự kiện
        AlertDetailPage.tsx             # Trang 5: Hồ sơ chi tiết sự kiện (/alerts/:eventId)
        DevicesPage.tsx                 # Trang 6: Thiết bị & Điều khiển phần cứng
        ReportsPage.tsx                 # Trang 7: Báo cáo & Xuất CSV kiểm toán
        SettingsPage.tsx                # Trang 8: Cấu hình thông số & Ma trận SIL-2
        LogsPage.tsx                    # Trang 9: Nhật ký hệ thống & Truy vết telemetry
        NotFoundPage.tsx                # Trang 404
      components/
        common/                         # StatusBadge, MetricCard, DataTable, ConfirmDialog, Toast...
        camera/                         # CameraPlayer, DetectionOverlay, SnapshotReel
        sensors/                        # SensorCards, SensorTelemetryGauge
        alerts/                         # EventTimeline
        devices/                        # DeviceControlWidget
        charts/                         # TelemetryDualAxisChart
      hooks/
        useFireWatch.ts                 # Hook truy cập dữ liệu và thao tác hệ thống
      services/
        contracts.ts                    # Interface IFireWatchService
        mockService.ts                  # Bộ sinh dữ liệu & giả lập kịch bản
        apiService.ts                   # Adapter gọi REST / WebSocket API thực tế
        index.ts                        # Singleton service factory
      mocks/
        seed.ts                         # Dữ liệu ban đầu
        scenarios.ts                    # Định nghĩa các kịch bản diễn tập
      types/
        index.ts                        # Toàn bộ kiểu dữ liệu TypeScript
      utils/
        formatters.ts                   # Định dạng số, chuỗi, thời gian
        exportCsv.ts                    # Xuất CSV có UTF-8 BOM hiển thị chuẩn tiếng Việt
```

---

## 4. Tích hợp Module vào Dự án React Khác

Module `FireWatchApp` được thiết kế khép kín (self-contained), không tự bọc `BrowserRouter` bên trong để dễ dàng nhúng vào bất kỳ ứng dụng React Router hiện hữu nào.

### Bước 1: Sao chép thư mục
Sao chép toàn bộ thư mục `src/features/firewatch` vào dự án của bạn (ví dụ `src/features/firewatch`).

### Bước 2: Cài đặt phụ thuộc cần thiết
```bash
npm install lucide-react recharts react-router-dom
```

### Bước 3: Đảm bảo font chữ và Tailwind
Thêm font **Inter** và **JetBrains Mono** vào file `index.html` của bạn:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Bước 4: Nhúng vào App router
#### Cách A: Mount tại thư mục gốc (`/`)
```tsx
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { FireWatchApp } from './features/firewatch';

export default function App() {
  return (
    <BrowserRouter>
      <FireWatchApp />
    </BrowserRouter>
  );
}
```

#### Cách B: Mount dưới tiền tố đường dẫn con (Sub-route `/firewatch/*`)
```tsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { FireWatchApp } from './features/firewatch';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<MyDashboard />} />
        <Route path="/firewatch/*" element={<FireWatchApp />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 5. Chuyển đổi giữa Chế độ Mock và API Thực tế

Trong file `.env` (hoặc biến môi trường build):

```env
# Chế độ Mock độc lập (Không cần backend)
VITE_DATA_MODE=mock
VITE_API_BASE_URL=

# Hoặc chế độ API Backend thực tế
VITE_DATA_MODE=api
VITE_API_BASE_URL=https://api.firewatch.internal
```

- **Khi `VITE_DATA_MODE=mock`**: Chạy hoàn toàn độc lập, hiển thị nhãn *“Dữ liệu mô phỏng”* trên Header, cho phép chuyển đổi 9 kịch bản diễn tập qua thanh Scenario Bar.
- **Khi `VITE_DATA_MODE=api`**: Chuyển sang `ApiFireWatchService`. Nếu `VITE_API_BASE_URL` trống hoặc máy chủ lỗi, giao diện sẽ báo lỗi rõ ràng chứ **không tự ý lùi về mock** nhằm đảm bảo an toàn dữ liệu giám sát.

---

## 6. Hợp đồng Dữ liệu Đề xuất (API Contracts)

Khi xây dựng backend (FastAPI / Node.js / Go / Rust), cung cấp các endpoint sau theo chuẩn JSON:

| Phương thức | Tuyến đường API | Mô tả |
|---|---|---|
| `GET` | `/api/areas` | Danh sách khu vực giám sát và cấp độ nguy cơ |
| `GET` | `/api/devices?areaId={id}` | Danh sách vi điều khiển ESP32, camera, rơ-le bơm |
| `GET` | `/api/sensors/latest?areaId={id}` | Số liệu mới nhất: DHT22, Flame ADC thô, MQ-2 ADC thô |
| `GET` | `/api/sensors/history?areaId={id}&range={m}` | Chuỗi thời gian lịch sử tách kênh |
| `GET` | `/api/alerts?status=&severity=&q=` | Danh sách cảnh báo và sự kiện điều tra |
| `GET` | `/api/alerts/{id}` | Chi tiết hồ sơ sự kiện, ảnh bằng chứng, timeline |
| `POST` | `/api/alerts/{id}/acknowledge` | Tiếp nhận cảnh báo (`{ operatorName }`) |
| `POST` | `/api/alerts/{id}/false-alarm` | Đánh dấu báo động giả (`{ reason, operatorName }`) |
| `POST` | `/api/alerts/{id}/close` | Đóng hồ sơ sự cố (`{ reason, operatorName }`) |
| `POST` | `/api/devices/command` | Gửi lệnh MQTT tới ESP32 (`{ targetDevice, gpio, payload, operator }`) |
| `GET` | `/api/devices/commands` | Lịch sử nhật ký phản hồi gói tin ACK lệnh phần cứng |
| `GET` | `/api/logs?level=&q=` | Luồng FIFO nhật ký hệ thống toàn vẹn dữ liệu |
| `GET` | `/api/settings` | Cấu hình ngưỡng AI, ADC và ma trận liên động SIL-2 |
| `PUT` | `/api/settings` | Lưu tham số cấu hình |
| `POST` | `/api/settings/sync-nvs` | Đẩy cấu hình OTA xuống bộ nhớ Flash NVS vi điều khiển |

---

## 7. Phân định Chức năng Frontend và Yêu cầu Backend

### Chức năng Frontend đã hoạt động hoàn chỉnh ngay:
- Bố cục tác chiến 8 mục Sidebar + Header dùng chung + Global Alert Banner + Scenario Bar.
- Điều hướng đồng bộ giữa các trang không mất trạng thái khu vực và ngữ cảnh hệ thống.
- Bounding Box overlay AI YOLOv8 vẽ trên video tọa độ tỷ lệ thực (1080p).
- 9 kịch bản mô phỏng tương tác: Bình thường, AI phát hiện lửa, Cảm biến kích hoạt, Bơm nước, Mất kết nối ESP32/Camera, v.v.
- Tiếp nhận sự cố, đánh dấu báo nhầm (kèm lý do), đóng sự kiện có xác nhận dialog.
- Biểu đồ đo lường độc lập không gộp trục gây sai lệch số liệu.
- Bộ lọc, tìm kiếm và phân trang tại tất cả các bảng dữ liệu.
- Xuất CSV kèm **UTF-8 BOM (`\uFEFF`)** để hiển thị đúng dấu tiếng Việt trên Microsoft Excel.

### Chức năng cần kết nối Backend thực tế khi triển khai hiện trường:
- Giải mã luồng RTSP camera IP trực tiếp từ đầu ghi H.264/H.265 (cần RTSP-to-WebRTC/HLS proxy hoặc WebCodecs).
- Dịch vụ suy luận mô hình AI YOLOv8 theo thời gian thực trên video tải lên (cần backend inference GPU/NPU).
- Kết nối broker MQTT thực tế (Mosquitto/EMQX) qua WebSocket để nhận telemetry từ ESP32-S3.
- Cơ sở dữ liệu phân tán (PostgreSQL/TimescaleDB/Supabase) để lưu trữ vĩnh viễn hàng trăm nghìn bản ghi nhật ký kiểm toán.
