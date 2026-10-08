const fs = require('fs');
const path = require('path');

const dict = {
  "Chua du dieu kien": "Chưa đủ điều kiện",
  "chua xác nhận": "chưa xác nhận",
  "cung khu vực": "cùng khu vực",
  "bao trang thai": "báo trạng thái",
  "khong con dieu kien": "không còn điều kiện",
  "Hieu chuan": "Hiệu chuẩn",
  "chi tao trang thai": "chỉ tạo trạng thái",
  "can theo doi": "cần theo dõi",
  "khong hien thi nhu da du dieu kien": "không hiển thị như đã đủ điều kiện",
  "Chưa được": "Chưa được",
  "dieu kien": "điều kiện",
  "la trang thai": "là trạng thái",
  "khong co": "không có",
  "luu luong/ap luc nuoc": "lưu lượng/áp lực nước",
  "nen khong ket luan": "nên không kết luận",
  "bom có nước": "bơm có nước",
  "Lenh bom van di theo luong": "Lệnh bơm vẫn đi theo luồng",
  "va cảm biến": "và cảm biến",
  "chi ghi nhan": "chỉ ghi nhận",
  "va thoi diem tiep nhan": "và thời điểm tiếp nhận",
  "Thao tác nay khong gửi lenh tat bom, coi hay den": "Thao tác này không gửi lệnh tắt bơm, còi hay đèn",
  "chi het khi": "chỉ hết khi",
  "ghi nhan tu": "ghi nhận từ",
  "Gia tri": "Giá trị",
  "nguong cảm biến": "ngưỡng cảm biến",
  "va lien dong gửi len backend": "và liên động gửi lên backend",
  "Dữ liệu thật tu": "Dữ liệu thật từ"
};

const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);

function replaceInContent(content) {
  let newContent = content;
  for (const key of sortedKeys) {
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    newContent = newContent.replace(regex, dict[key]);
  }
  // also case sensitive global replace for exact phrases to be safe
  for (const key of sortedKeys) {
    newContent = newContent.split(key).join(dict[key]);
  }
  return newContent;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = replaceInContent(content);
  
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
console.log('Accents restoration straggler step complete');
