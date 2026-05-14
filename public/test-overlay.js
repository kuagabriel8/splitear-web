const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, 'overlay-test.html');
const bgImage = 'images/leftearrightear.jpg';
const width = 307;
const height = 164;

const rightThumbnailUrl = 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg';
const leftThumbnailUrl = 'https://img.youtube.com/vi/oHg5SJYRHA0/hqdefault.jpg';

// Estimated overlay coordinates based on the "Right ear" and "Left ear" text positions.
const rightOverlay = { x: 25, y: 39, width: 120 };
const leftOverlay = { x: 194, y: 36, width: 120 };

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Left/Right Ear Overlay Test</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      background: #111;
      color: #fff;
      font-family: Arial, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
    }
    .frame {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: ${width}px;
      height: ${height}px;
      background: url('${bgImage}') no-repeat top left;
      background-size: ${width}px ${height}px;
      border: 1px solid #555;
      box-shadow: 0 16px 36px rgba(0,0,0,0.7);
    }
    .overlay {
      position: absolute;
      width: 120px;
      aspect-ratio: 16 / 9;
      border: none;
      box-shadow: 0 0 18px rgba(0,0,0,0.35);
      background: transparent;
      overflow: hidden;
      border-radius: 12px;
    }
    .overlay img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .top-text {
      padding: 24px;
      text-align: center;
      max-width: 640px;
    }
  </style>
</head>
<body>
  <div class="top-text">
    <h1>Overlay Position Test</h1>
    <p>This page uses the original image as a background and places two thumbnail overlays in the same positions.</p>
  </div>
  <div class="frame">
    <div class="overlay" style="left: ${rightOverlay.x}px; top: ${rightOverlay.y}px; width: ${rightOverlay.width}px;">
      <img src="${rightThumbnailUrl}" alt="Right thumbnail" />
    </div>
    <div class="overlay" style="left: ${leftOverlay.x}px; top: ${leftOverlay.y}px; width: ${leftOverlay.width}px;">
      <img src="${leftThumbnailUrl}" alt="Left thumbnail" />
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(outPath, html, 'utf8');
console.log(`Generated overlay HTML at ${outPath}`);
console.log('Coordinates:');
console.log('Right overlay -> x=' + rightOverlay.x + ', y=' + rightOverlay.y);
console.log('Left overlay  -> x=' + leftOverlay.x + ', y=' + leftOverlay.y);
