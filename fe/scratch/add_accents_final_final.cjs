const fs = require('fs');
const path = require('path');

const dict = {
  "giam sat": "giám sát",
  "Khu vực giam sat": "Khu vực giám sát",
  "nhan dien": "nhận diện",
  "luu capture": "lưu capture",
  "gửi su kien": "gửi sự kiện",
  "ve backend": "về backend",
  "nguong suy luan": "ngưỡng suy luận",
  "GIAM SAT": "GIÁM SÁT",
  "CAM BIEN": "CẢM BIẾN",
  "MO TRUONG": "MÔI TRƯỜNG",
  "HIEN TRUONG": "HIỆN TRƯỜNG",
  "Thông số Ky thuat": "Thông số Kỹ thuật",
  "Anh xa": "Ánh xạ",
  "Phan cung": "Phần cứng",
  "Ma su kien": "Mã sự kiện",
  "Muc do": "Mức độ",
  "Nguoi tiep nhan": "Người tiếp nhận",
  "Thao tac": "Thao tác",
  "Bơm chua chay": "Bơm chữa cháy",
  "bao ve": "báo về",
  "Gui ON": "Gửi ON",
  "Gui OFF": "Gửi OFF",
  "Còi bao dong": "Còi báo động",
  "Gui bat coi": "Gửi bật còi",
  "Gui tat coi": "Gửi tắt còi",
  "Đèn canh bao": "Đèn cảnh báo",
  "Báo cáo canh bao": "Báo cáo cảnh báo",
  "Khong tinh": "Không tính",
  "hoặc ty le bao gia": "hoặc tỷ lệ báo giả",
  "khi chua co du lieu": "khi chưa có dữ liệu",
  "nghiem thu": "nghiệm thu",
  "Tong canh bao": "Tổng cảnh báo",
  "So bản ghi": "Số bản ghi",
  "Chua tiep nhan": "Chưa tiếp nhận",
  "Điều kiện dang active": "Điều kiện đang active",
  "Chua duoc": "Chưa được",
  "ghi cleared": "ghi cleared",
  "Lịch sử canh bao": "Lịch sử cảnh báo",
  "Tiếp nhận la thao tac": "Tiếp nhận là thao tác",
  "nguoi van hanh": "người vận hành",
  "cap nhat theo": "cập nhật theo",
  "cảm biến va AI": "cảm biến và AI",
  "Ma canh bao": "Mã cảnh báo",
  "Nguon": "Nguồn",
  "Chua ro": "Chưa rõ",
  "Moi": "Mới",
  "Điều kiện da het": "Điều kiện đã hết",
  "canh bao": "cảnh báo",
  "Báo cáo canh bao": "Báo cáo cảnh báo",
  "cảm biến": "cảm biến",
  "canh bao som": "cảnh báo sớm",
  "su kien": "sự kiện",
  "thiet bi": "thiết bị",
  "Coi": "Còi",
  "Den": "Đèn",
  "Khu vuc": "Khu vực"
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
console.log('Accents restoration final final step complete');
