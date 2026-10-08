const fs = require('fs');
const path = require('path');

const dict = {
  "Dang nhap that bai": "Đăng nhập thất bại",
  "Vui long kiem tra lai tai khoan": "Vui lòng kiểm tra lại tài khoản",
  "Dang nhap": "Đăng nhập",
  "Dang dang nhap": "Đang đăng nhập",
  "Dang ghi nhan": "Đang ghi nhận",
  "Giam sat": "Giám sát",
  "canh bao som": "cảnh báo sớm",
  "dieu phoi": "điều phối",
  "he thong": "hệ thống",
  "phong chay chua chay": "phòng cháy chữa cháy",
  "Tong quan": "Tổng quan",
  "Cau hinh": "Cấu hình",
  "Camera AI phat hien lua/khoi": "Camera AI phát hiện lửa/khói",
  "Chua co thiet bi ESP32": "Chưa có thiết bị ESP32",
  "Trung tam canh bao chay": "Trung tâm cảnh báo cháy",
  "Tim theo ma": "Tìm theo mã",
  "khu vuc": "khu vực",
  "nguon": "nguồn",
  "Lich su": "Lịch sử",
  "Gui yeu cau": "Gửi yêu cầu",
  "bat bom": "bật bơm",
  "Lenh dieu khien": "Lệnh điều khiển",
  "Nhiet am": "Nhiệt ẩm",
  "Bang Lich Su": "Bảng Lịch Sử",
  "Do Luong": "Đo Lường",
  "Chi Tiet": "Chi Tiết",
  "Nhiet do": "Nhiệt độ",
  "Do am": "Độ ẩm",
  "Canh bao": "Cảnh báo",
  "Tiep nhan": "Tiếp nhận",
  "Dieu kien": "Điều kiện",
  "Du lieu": "Dữ liệu",
  "He thong": "Hệ thống",
  "Thiet bi": "Thiết bị",
  "Khu vuc": "Khu vực",
  "Trang thai": "Trạng thái",
  "Chua co": "Chưa có",
  "trong database": "trong database",
  "telemetry": "telemetry",
  "DHT22": "DHT22",
  "ESP32": "ESP32",
  "Camera AI": "Camera AI",
  "phat hien": "phát hiện",
  "lua/khoi": "lửa/khói",
  "lua": "lửa",
  "khoi": "khói",
  "that bai": "thất bại",
  "that": "thật",
  "tai khoan": "tài khoản",
  "mat ket noi": "mất kết nối",
  "Mat ket noi": "Mất kết nối",
  "Chua live": "Chưa live",
  "co frame": "có frame",
  "Luong bat bom": "Luồng bật bơm",
  "cam bien": "cảm biến",
  "xac nhan": "xác nhận",
  "trong cung": "trong cùng",
  "dang theo doi": "đang theo dõi",
  "Khi du": "Khi đủ",
  "kep": "kép",
  "gui": "gửi",
  "phat hien don le": "phát hiện đơn lẻ",
  "hoac": "hoặc",
  "chua du": "chưa đủ",
  "de xem la": "để xem là",
  "tu backend": "từ backend",
  "MAT TIN HIEU": "MẤT TÍN HIỆU",
  "Chua nhan duoc": "Chưa nhận được",
  "moi tu": "mới từ",
  "Kiem tra": "Kiểm tra",
  "duong dan": "đường dẫn",
  "Cam bien": "Cảm biến",
  "Du lieu cu": "Dữ liệu cũ",
  "tho": "thô",
  "Khong ket luan": "Không kết luận",
  "khi thieu": "khi thiếu",
  "moi": "mới",
  "Chi luu": "Chỉ lưu",
  "khong quy doi": "không quy đổi",
  "thanh nong do khi": "thành nồng độ khí",
  "Relay bom": "Relay bơm",
  "Coi": "Còi",
  "Den": "Đèn",
  "chi la": "chỉ là",
  "do ESP32 bao lai": "do ESP32 báo lại",
  "khong chung minh": "không chứng minh",
  "co nuoc": "có nước",
  "co ap luc": "có áp lực",
  "Thiet bi chap hanh": "Thiết bị chấp hành",
  "Bom chua chay": "Bơm chưa chạy",
  "Trang thai ESP32 bao ve": "Trạng thái ESP32 báo về",
  "Coi bao dong": "Còi báo động",
  "Den canh bao": "Đèn cảnh báo",
  "Day la": "Đây là",
  "dau ra": "đầu ra",
  "Toi trang": "Tới trang",
  "dieu khien": "điều khiển",
  "Lich su telemetry": "Lịch sử telemetry",
  "Gia tri loi": "Giá trị lỗi",
  "duoc giu trong": "được giữ trống",
  "khong thay bang": "không thay bằng",
  "ban ghi": "bản ghi",
  "Do am": "Độ ẩm",
  "Nguong": "Ngưỡng",
  "su kien gan nhat": "sự kiện gần nhất",
  "Tat ca": "Tất cả",
  "MUC CAO": "MỨC CAO",
  "phat hien": "phát hiện"
};

// We will use a regex replacing function that matches word boundaries or specific phrases.
// It's safer to just replace exact phrases first, then words.
const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);

function replaceInContent(content) {
  let newContent = content;
  for (const key of sortedKeys) {
    // Only replace if it doesn't break HTML/JSX tags entirely, but since it's just text it should be fine.
    // We can use a global regex. To avoid replacing inside classNames, we could be careful, but these are Vietnamese words.
    // We will do a global replace for the exact string.
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    newContent = newContent.replace(regex, dict[key]);
  }
  return newContent;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = replaceInContent(content);
  // Manual fix for "Đã tiếp nhận" which might have been partially matched
  newContent = newContent.replace(/Đa tiep nhan/g, 'Đã tiếp nhận');
  newContent = newContent.replace(/Đa/g, 'Đã');
  
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Updated', filePath);
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (fullPath.includes('node_modules')) continue;
      walk(fullPath);
    } else if (fullPath.match(/\.(tsx?|jsx?|ts|js)$/i)) {
      processFile(fullPath);
    }
  }
}

const srcRoot = path.resolve(__dirname, '..', 'src');
walk(srcRoot);
console.log('Accents restoration final step complete');
