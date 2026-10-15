# Fire-Watch trên Vercel, backend và camera trên máy hiện tại

## Trạng thái cấu hình

- Frontend được chủ project cung cấp: `https://fire-watch-self.vercel.app`.
- Backend local đã kiểm tra: `http://127.0.0.1:8000/health` trả `status=ok`, `mqtt_connected=true`.
- Chế độ hiện tại: FE trên Vercel, BE local trên chính máy mở trình duyệt, `VITE_API_BASE_URL=http://127.0.0.1:8000`. Không cần tunnel cho chế độ này. Muốn dùng từ thiết bị khác cần endpoint truy cập được và bảo vệ trước khi công khai.
- Camera giữ local: `http://127.0.0.1:8090`, stream `/stream`. Health cổng 8090 chưa kết nối được lúc kiểm tra; không khẳng định camera đang chạy.
- Người dùng chọn bảo vệ truy cập trước khi công khai backend, và hiện chưa có tài khoản Cloudflare/tên miền riêng. Không tunnel nào được khởi chạy.
- File `.env` ở gốc project đã có allowlist CORS gồm hai origin Vercel người dùng cung cấp và các origin local. `.env.example` chứa cùng cấu hình không bí mật để tái sử dụng. Đã build/recreate riêng backend và kiểm tra OPTIONS từ cả hai origin Vercel trả 200 với đúng Allow-Origin; origin ngoài allowlist vẫn trả 400. Health sau restart: `ok`, MQTT kết nối.

## Biến import lên Vercel

Mẫu [fe/vercel.env.example](../fe/vercel.env.example) chứa đủ 9 biến mà source frontend sử dụng. Cả ba URL đã điền chế độ local và sáu biến tùy chọn giữ mặc định code. Import vào Vercel rồi Redeploy; không tự động thay đổi biến trên tài khoản Vercel chỉ bằng commit file mẫu.

| Key | Giá trị / trạng thái |
|---|---|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` |
| `VITE_CAMERA_SERVICE_URL` | `http://127.0.0.1:8090` |
| `VITE_CAMERA_STREAM_URL` | `http://127.0.0.1:8090/stream` |
| `VITE_PUMP_AUTO_ON_DELAY_MS` | `4000` |
| `VITE_PUMP_AUTO_OFF_DELAY_MS` | `4000` |
| `VITE_SENSOR_FIRE_CONFIRM_WINDOW_MS` | `10000` |
| `VITE_PERSON_TTS_MAX_AGE_SECONDS` | `3` |
| `VITE_PIPER_TTS_LENGTH_SCALE` | `0.95` |
| `VITE_PIPER_TTS_SENTENCE_SILENCE` | `0.35` |

Chọn Config, Production. Chỉ thêm Preview nếu có cấu hình CORS cho đúng origin Preview. Các biến `VITE_` có thể xem từ trình duyệt, không chứa secret. Không thêm biến database, mật khẩu EMQX, JWT secret hoặc token tunnel vào frontend.

`127.0.0.1` trỏ tới thiết bị mở trình duyệt: BE và camera này chỉ dùng được khi mở website trên chính máy chạy các dịch vụ. Điện thoại/máy khác không tự truy cập được máy chủ bằng URL này. Trình duyệt có thể yêu cầu quyền truy cập mạng local hoặc chặn request; cần kiểm tra thực tế từ website HTTPS. Không khẳng định camera sẽ hiển thị chỉ nhờ điền biến.

## Đối chiếu repo tham khảo

Repo [nhom2_io_smart-environment](https://github.com/khoin8507-afk/nhom2_io_smart-environment) có frontend đọc `VITE_API_URL`, mặc định `http://localhost:8080/api/v1` trong [api.ts](https://github.com/khoin8507-afk/nhom2_io_smart-environment/blob/main/web-react/src/services/api.ts). Khi kiểm tra asset `/assets/index-llNGJhfv.js` trên website Vercel được repo khai báo, baseURL đã build cũng là `http://localhost:8080/api/v1`. Điều này xác nhận cách cấu hình BE local, không chứng minh đăng nhập/điều khiển hoạt động trên mọi thiết bị.

Backend mẫu dùng Spring Security/JWT, CORS mặc định `*` và FE gửi Bearer token. Fire-Watch dùng FastAPI, cổng 8000, route `/api/...`, biến `VITE_API_BASE_URL`; không sao chép cổng 8080, hậu tố `/api/v1` hoặc tên biến của repo kia. Giữ allowlist CORS cụ thể thay vì mở mọi origin. Không thay đổi logic điều khiển MQTT hoặc xác nhận cháy trong phần sửa kết nối local này.

Đã sửa riêng URL đăng nhập trong `fe/src/App.tsx` để biến rỗng dùng fallback loopback và bỏ dấu `/` cuối, thống nhất với API service. Trước đó biến rỗng được giữ nguyên bởi toán tử `??`, khiến login có thể gọi nhầm `/api/auth/login` trên origin Vercel.

## Thiết lập Vercel

| Trường | Giá trị |
|---|---|
| Root Directory | `fe` |
| Framework | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js | 22.x hoặc 24.x |

File `fe/vercel.json` có rewrite về `index.html` cho React Router. FE có thể build và deploy riêng khi chưa có URL backend. Build thành công chỉ xác nhận tạo được giao diện; đăng nhập và dữ liệu cần backend truy cập được từ trình duyệt. Khi thiếu biến, frontend vẫn dùng địa chỉ local mặc định trong source; từ thiết bị khác các địa chỉ đó không trỏ về máy chạy backend. Đổi biến cần Redeploy. Build local/Docker vẫn dùng `npm run build` như trước.

Nếu dashboard Vercel đang lưu Build Command cũ `node scripts/check-deployment-env.mjs && npm run build`, đổi thành `npm run build` hoặc tắt override để dùng file cấu hình. Kiểm tra URL vẫn có thể chạy riêng khi đã có URL backend thật: `node scripts/check-deployment-env.mjs`. Đây là bước tùy chọn, không còn chặn deploy FE.

## Bảo vệ backend trước khi mở mạng

Source hiện có endpoint login kiểm tra tài khoản, nhưng chưa phát token/session được bắt buộc ở mọi route dữ liệu, điều khiển và WebSocket. Chỉ có màn hình đăng nhập hoặc CORS không bảo vệ được API khỏi truy cập trực tiếp.

Cần hoàn thành một phương án trước khi tạo URL công khai:

1. Bổ sung xác thực/ủy quyền cho các API và WebSocket, đồng thời giữ đường ingest AI nội bộ hoạt động đúng. Cần triển khai và kiểm thử tích hợp này riêng trước khi mở tunnel; chưa được thực hiện trong lần cấu hình biến môi trường này.
2. Dùng gateway có xác thực, ví dụ Cloudflare Access với tài khoản, hostname và policy do chủ project quản lý. Cần kiểm tra cả login, CORS, credential/cookie và WebSocket từ frontend Vercel; không chỉ bật Access rồi coi frontend hiện có sẽ tự hoạt động.

Không thể tự tìm trên Internet các token tài khoản hoặc tự cấp tên miền thuộc quyền quản lý của người dùng. Không đưa các token này vào chat hoặc repository.

Công cụ `cloudflared` chính thức đã được tải vào `.vercel-local/cloudflared.exe`, xác minh SHA256 theo GitHub release. Thư mục này được gitignore, không được upload lên Vercel. Tự động phê duyệt đã từ chối tạo Quick Tunnel vì backend có route điều khiển chưa được bảo vệ; không có tunnel nào được chạy để vượt qua quyết định đó. Script cũ `scripts/start-vercel-tunnels.ps1` hiện mặc định dừng ngay, không mở dịch vụ.

## Áp dụng và nghiệm thu chế độ BE local

Import mẫu với URL loopback đã điền vào Vercel, Redeploy, mở bằng trình duyệt trên chính máy chạy BE. CORS đã được áp dụng cho `https://fire-watch-self.vercel.app` và `https://fire-watch-abbje8wxt-dkh4.vercel.app`. Khi đổi danh sách origin trong `.env` gốc, áp dụng lại bằng:

```powershell
docker compose up -d --no-deps --build backend
```

Lệnh này recreate backend; chọn thời điểm phù hợp việc giám sát. PostgreSQL và EMQX vẫn giữ local. Không chạy lệnh này chỉ để kiểm tra file cấu hình.

Kiểm tra quyền mạng local của website trong trình duyệt, login, dữ liệu và routing khi tải lại trang con. Với API loopback HTTP, frontend tạo WebSocket `ws://127.0.0.1:8000/ws`; trình duyệt có thể áp dụng giới hạn từ trang HTTPS, cần kiểm tra thực tế. Nếu chuyển sang API HTTPS, frontend tự tạo `wss://`. Camera cần bật AI trên máy trước. Chưa kiểm thử đăng nhập trong browser Vercel hoặc lệnh thiết bị thật. Không tạo cháy giả/gửi lệnh thiết bị chỉ để thử deployment. Piper, MQTT, PostgreSQL và firmware giữ nguyên luồng hiện tại.

Nguồn: [Vercel configuration](https://vercel.com/docs/project-configuration), [environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables), [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/), [Cloudflare Access settings](https://developers.cloudflare.com/tunnel/advanced/origin-parameters/).
