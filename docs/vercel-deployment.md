# Fire-Watch trên Vercel, backend và camera trên máy hiện tại

## Trạng thái cấu hình

- Frontend được chủ project cung cấp: `https://fire-watch-self.vercel.app`.
- Backend local đã kiểm tra: `http://127.0.0.1:8000/health` trả `status=ok`, `mqtt_connected=true`.
- Chưa có URL backend HTTPS được bảo vệ. Không điền URL giả hoặc IP local vào biến backend của Vercel.
- Camera giữ local: `http://127.0.0.1:8090`, stream `/stream`. Health cổng 8090 chưa kết nối được lúc kiểm tra; không khẳng định camera đang chạy.
- Người dùng chọn bảo vệ truy cập trước khi công khai backend, và hiện chưa có tài khoản Cloudflare/tên miền riêng. Không tunnel nào được khởi chạy.
- File `.env` ở gốc project đã có allowlist CORS gồm origin Vercel thật và các origin local. `.env.example` chứa cùng cấu hình không bí mật để tái sử dụng. Cấu hình chưa được áp dụng vào container đang chạy; chưa restart backend.

## Biến import lên Vercel

Mẫu [fe/vercel.env.example](../fe/vercel.env.example) chứa đủ 9 biến mà source frontend sử dụng. Hai biến camera và sáu biến tùy chọn đã có giá trị tương ứng với yêu cầu camera local và mặc định code. `VITE_API_BASE_URL` cố ý để trống vì chưa có dịch vụ HTTPS được bảo vệ.

| Key | Giá trị / trạng thái |
|---|---|
| `VITE_API_BASE_URL` | Chờ URL backend HTTPS thật có bảo vệ; không thêm `/api`, `/docs`, `/ws` hoặc dấu `/` cuối |
| `VITE_CAMERA_SERVICE_URL` | `http://127.0.0.1:8090` |
| `VITE_CAMERA_STREAM_URL` | `http://127.0.0.1:8090/stream` |
| `VITE_PUMP_AUTO_ON_DELAY_MS` | `4000` |
| `VITE_PUMP_AUTO_OFF_DELAY_MS` | `4000` |
| `VITE_SENSOR_FIRE_CONFIRM_WINDOW_MS` | `10000` |
| `VITE_PERSON_TTS_MAX_AGE_SECONDS` | `3` |
| `VITE_PIPER_TTS_LENGTH_SCALE` | `0.95` |
| `VITE_PIPER_TTS_SENTENCE_SILENCE` | `0.35` |

Chọn Config, Production. Chỉ thêm Preview nếu có cấu hình CORS cho đúng origin Preview. Các biến `VITE_` có thể xem từ trình duyệt, không chứa secret. Không thêm biến database, mật khẩu EMQX, JWT secret hoặc token tunnel vào frontend.

`127.0.0.1` trỏ tới thiết bị mở trình duyệt: camera này chỉ dùng được khi mở website trên chính máy chạy camera. Điện thoại/máy khác không tự truy cập được camera trên máy chủ bằng URL này. Trình duyệt có thể yêu cầu quyền truy cập mạng local hoặc chặn request; cần kiểm tra thực tế từ website HTTPS. Không khẳng định camera sẽ hiển thị chỉ nhờ điền biến.

## Thiết lập Vercel

| Trường | Giá trị |
|---|---|
| Root Directory | `fe` |
| Framework | Vite |
| Install Command | `npm ci` |
| Build Command | `node scripts/check-deployment-env.mjs && npm run build` |
| Output Directory | `dist` |
| Node.js | 22.x hoặc 24.x |

File `fe/vercel.json` có rewrite về `index.html` cho React Router. Build Vercel kiểm tra định dạng URL, cho phép camera loopback HTTP cổng 8090 theo lựa chọn của người dùng, nhưng vẫn yêu cầu backend HTTPS công khai. Khi chưa có URL backend, build chủ động dừng; không coi frontend gọi localhost là bản triển khai thành công. Đổi biến cần Redeploy. Build local/Docker vẫn dùng `npm run build` như trước.

## Bảo vệ backend trước khi mở mạng

Source hiện có endpoint login kiểm tra tài khoản, nhưng chưa phát token/session được bắt buộc ở mọi route dữ liệu, điều khiển và WebSocket. Chỉ có màn hình đăng nhập hoặc CORS không bảo vệ được API khỏi truy cập trực tiếp.

Cần hoàn thành một phương án trước khi tạo URL công khai:

1. Bổ sung xác thực/ủy quyền cho các API và WebSocket, đồng thời giữ đường ingest AI nội bộ hoạt động đúng. Cần triển khai và kiểm thử tích hợp này riêng trước khi mở tunnel; chưa được thực hiện trong lần cấu hình biến môi trường này.
2. Dùng gateway có xác thực, ví dụ Cloudflare Access với tài khoản, hostname và policy do chủ project quản lý. Cần kiểm tra cả login, CORS, credential/cookie và WebSocket từ frontend Vercel; không chỉ bật Access rồi coi frontend hiện có sẽ tự hoạt động.

Không thể tự tìm trên Internet các token tài khoản hoặc tự cấp tên miền thuộc quyền quản lý của người dùng. Không đưa các token này vào chat hoặc repository.

Công cụ `cloudflared` chính thức đã được tải vào `.vercel-local/cloudflared.exe`, xác minh SHA256 theo GitHub release. Thư mục này được gitignore, không được upload lên Vercel. Tự động phê duyệt đã từ chối tạo Quick Tunnel vì backend có route điều khiển chưa được bảo vệ; không có tunnel nào được chạy để vượt qua quyết định đó. Script cũ `scripts/start-vercel-tunnels.ps1` hiện mặc định dừng ngay, không mở dịch vụ.

## Áp dụng và nghiệm thu sau khi có bảo vệ + URL backend

Điền URL backend thật vào mẫu rồi import các biến vào Vercel. CORS đã được chuẩn bị trong `.env` gốc cho `https://fire-watch-self.vercel.app`. Khi sẵn sàng áp dụng vào backend Docker:

```powershell
docker compose up -d --no-deps --build backend
```

Lệnh này recreate backend; chọn thời điểm phù hợp việc giám sát. PostgreSQL và EMQX vẫn giữ local. Không chạy lệnh này chỉ để kiểm tra file cấu hình.

Kiểm tra request chưa đăng nhập bị chặn, người được phép đăng nhập và đọc dữ liệu, WebSocket `/ws` qua `wss`, routing khi tải lại trang con, camera local khi bật AI và quyền mạng local trên trình duyệt. Không tạo cháy giả/gửi lệnh thiết bị chỉ để thử deployment. Piper, MQTT, PostgreSQL và firmware giữ nguyên luồng hiện tại.

Nguồn: [Vercel configuration](https://vercel.com/docs/project-configuration), [environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables), [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/), [Cloudflare Access settings](https://developers.cloudflare.com/tunnel/advanced/origin-parameters/).
