# Thông báo Android Fire-Watch

App Flutter trong `mobile` có thông báo hệ thống Android qua MethodChannel `firewatch/notifications`, không thêm package. Khi Android yêu cầu quyền thông báo, người dùng cần chọn **Cho phép**. Nếu đã từ chối hoặc tắt kênh cảnh báo, trang chính có nút mở cài đặt thông báo của app.

Luồng: sự kiện WebSocket hoặc polling → đọc bản ghi cảnh báo thật từ `/api/alerts/{id}` → kiểm tra còn điều kiện và đúng khu vực → NotificationManager gửi thông báo lên thanh thông báo Android. Một mã cảnh báo chỉ phát thông báo một lần trong phiên app khi đã gửi thành công. Các thông báo cùng mã dùng cùng notification ID; chạm thông báo mở lại app. Banner trong app vẫn được giữ.

Thông báo phân biệt nguồn camera/cảm biến, không tự gọi một nguồn là cháy xác nhận kép. Sự kiện hết điều kiện không tạo thông báo mới. Ảnh hưởng của thay đổi này chỉ nằm ở app mobile, không đổi điều kiện bật bơm hoặc backend/MQTT.

Đây là **thông báo cục bộ cho sự kiện mà app nhận được**, chưa phải push khi app bị đóng hẳn. Khi Android dừng hoặc treo kết nối của app nền, app không có đường nhận sự kiện mới độc lập. Chưa tích hợp FCM hoặc dịch vụ nhận nền. Thông báo đã gửi vẫn do Android quản lý; việc hiển thị banner nổi, âm thanh và màn hình khóa còn tùy quyền/kênh thông báo và chế độ Không làm phiền của điện thoại.

Các file chính:

- `mobile/lib/services/notification_service.dart`: cầu nối Flutter–Android.
- `mobile/android/app/src/main/kotlin/com/firewatch/fire_watch/MainActivity.kt`: quyền Android 13+, kênh thông báo ưu tiên cao, notification và thao tác mở app.
- `mobile/lib/screens/home_screen.dart`: xác minh dữ liệu, chống trùng, giữ cảnh báo trong app.
- `mobile/lib/services/websocket_service.dart`: sự kiện AI được đọc lại từ backend thay vì tự dựng cảnh báo xác nhận.

Build và cài bản mới bằng SDK hiện có:

```powershell
cd C:\Class\IOT\project_final_iot\mobile
flutter build apk --debug --no-pub
```

APK: `mobile/build/app/outputs/flutter-apk/app-debug.apk`. Cần cài bản APK mới để có phần Android native; hot reload không bổ sung quyền hoặc MethodChannel vào bản app cũ.

Kiểm thử:

```powershell
flutter analyze --no-pub --no-fatal-infos
flutter test --no-pub
```
