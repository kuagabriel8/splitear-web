const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'public', 'images', 'leftearrightear.jpg');
const buf = fs.readFileSync(file);
let i = 2; // skip SOI
if (buf[0] !== 0xFF || buf[1] !== 0xD8) {
  console.error('not jpeg');
  process.exit(1);
}
let count = 0;
while (i < buf.length && count < 20) {
  if (buf[i] !== 0xFF) { i++; continue; }
  const marker = buf[i+1];
  const len = buf.readUInt16BE(i+2);
  console.log('marker', marker.toString(16), 'pos', i, 'len', len);
  if (marker === 0xC0 || marker === 0xC2) {
    const height = buf.readUInt16BE(i+5);
    const width = buf.readUInt16BE(i+7);
    console.log('dims', width, height);
    process.exit(0);
  }
  i += 2 + len;
  count++;
}
console.error('size marker not found');
process.exit(1);
