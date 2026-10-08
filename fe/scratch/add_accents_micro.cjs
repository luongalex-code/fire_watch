const fs = require('fs');
const path = require('path');

const dict = {
  "neu cảm biến": "nếu cảm biến",
  "tu cảm biến": "từ cảm biến",
  "neu camera": "nếu camera",
  "ghi nhan cảm biến": "ghi nhận cảm biến",
  "cung active": "cũng active",
  "Nhan \"Đã tiếp nhận\"": "Nhấn \"Đã tiếp nhận\""
};

const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);

function replaceInContent(content) {
  let newContent = content;
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
console.log('Accents restoration micro step complete');
