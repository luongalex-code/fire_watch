const fs = require('fs');
const path = require('path');

// Map of unaccented Vietnamese strings to accented versions (extended)
const replaceMap = {
  'Nhat ky he thong': 'Nhật ký hệ thống',
  'Chua co du lieu': 'Chưa có dữ liệu',
  'Da tiep nhan': 'Đã tiếp nhận',
  'Tong log': 'Tổng log',
  'Cap do': 'Cấp độ',
  'Phan he': 'Phần hệ',
  'Noi dung': 'Nội dung',
  'Thoi diem': 'Thời điểm',
  'Thoi gian': 'Thời gian',
  'Khong tai duoc': 'Không tải được',
  'Khong co du lieu': 'Chưa có dữ liệu',
  'Khong ket noi': 'Không kết nối',
  'Khong hien thi': 'Không hiển thị',
  'Khong duoc luu': 'Không được lưu',
  'Khong luu duoc': 'Không lưu được',
  'Xuat CSV': 'Xuất CSV',
  'Da sao chep log': 'Đã sao chép log',
  'Ban ghi audit da duoc copy vao clipboard.': 'Bản ghi audit đã được copy vào clipboard.',
  'Lay tu audit log backend': 'Lấy từ audit log backend',
  'Kieu chuoi': 'Kiểu chuỗi',
  'Bang audit log': 'Bảng audit log',
  'Chua du lieu': 'Chưa dữ liệu',
  'Chua co du lieu canh bao': 'Chưa có dữ liệu cảnh báo',
  'Chua du lieu canh bao': 'Chưa có dữ liệu cảnh báo',
  'Da tiep nhan canh bao': 'Đã tiếp nhận cảnh báo',
  'Thong tin': 'Thông tin',
  'Da nhan': 'Đã nhận',
  'Da nhap': 'Đã nhập',
  'Da xac nhan': 'Đã xác nhận',
  'Da dang nhap': 'Đã đăng nhập',
  'Da sao chep log': 'Đã sao chép log',
  // Additional missing phrases
  'Khong co so do': 'Không có số đo',
  'Khong tim thay trang': 'Không tìm thấy trang',
  'Khong tim thay canh bao phu hop': 'Không tìm thấy cảnh báo phù hợp',
  'Khong co capture phu hop voi bo loc hien tai': 'Không có capture phù hợp với bộ lọc hiện tại',
  'Khong ket luan trang thai khi thieu du lieu moi.': 'Không kết luận trạng thái khi thiếu dữ liệu mới.',
  'Khong the truy xuat thong tin tu gateway dieu khien.': 'Không thể truy xuất thông tin từ gateway điều khiển.',
  'Khong tim thay canh bao phu hop': 'Không tìm thấy cảnh báo phù hợp',
  // General terms
  'Khu vuc': 'Khu vực',
  'Thiet bi': 'Thiết bị',
  'Canh bao': 'Cảnh báo',
  'Den': 'Đèn',
  'Coi': 'Còi',
  'Bom': 'Bơm',
  'Nhiet do': 'Nhiệt độ',
  'Do am': 'Độ ẩm',
  'Trang thai': 'Trạng thái',
  'Chua co du lieu moi': 'Chưa có dữ liệu mới',
  // Add other known phrases as needed
};

function replaceInContent(content) {
  let newContent = content;
  for (const [key, value] of Object.entries(replaceMap)) {
    const regex = new RegExp(key, 'g');
    newContent = newContent.replace(regex, value);
  }
  return newContent;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const newContent = replaceInContent(content);
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
    } else if (fullPath.match(/\.(tsx?|jsx?|ts|js|css|json)$/i)) {
      processFile(fullPath);
    }
  }
}

const srcRoot = path.resolve(__dirname, '..', 'src');
walk(srcRoot);
console.log('Accented restore extended complete');
