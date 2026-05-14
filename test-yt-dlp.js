const { spawn } = require('child_process');
const fs = require('fs');
const { YOUTUBE_DL_PATH } = require('yt-dlp-exec/src/constants');

function downloadAndPlayYouTubeAudio(url, outputFile) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading audio from: ${url} to ${outputFile}`);

    const args = [
      '-f', 'bestaudio[ext=m4a]/bestaudio',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificate',
      '-o', outputFile,
      url,
    ];

    const ytdlp = spawn(YOUTUBE_DL_PATH, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let errorOutput = '';

    ytdlp.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
      console.log('yt-dlp:', chunk.toString().trim());
    });

    ytdlp.on('error', (error) => {
      console.error('❌ yt-dlp spawn error:', error.message);
      reject(error);
    });

    ytdlp.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Download completed successfully');
        // Play the file on Windows
        const playProcess = spawn('cmd', ['/c', 'start', '', outputFile], {
          detached: true,
          stdio: 'ignore'
        });
        playProcess.unref();
        console.log(`🎵 Playing ${outputFile} with default player`);
        resolve(true);
      } else {
        console.error('❌ yt-dlp exited with code:', code);
        console.error('Error output:', errorOutput);
        reject(new Error(`yt-dlp failed with code ${code}`));
      }
    });
  });
}

// Test with a sample URL
const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Roll
const outputFile = 'test-audio.m4a';

if (fs.existsSync(outputFile)) {
  fs.unlinkSync(outputFile);
}

downloadAndPlayYouTubeAudio(testUrl, outputFile)
  .then(() => console.log('🎉 Test passed: Audio downloaded and played'))
  .catch((err) => console.error('💥 Test failed:', err.message))
  .finally(() => process.exit(0));
