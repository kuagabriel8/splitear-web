# Split Ear YouTube Player

A simple local web app that lets users enter two YouTube links and play one audio stream in the left ear and the other in the right ear.

## Setup

1. Open a terminal
2. Run:
   ```bash
   npm install
   npm start
   ```
3. Open `http://localhost:3000` in your browser.

## How it works

- The frontend accepts two YouTube URLs.
- The backend uses `ytdl-core` to fetch audio from YouTube.
- The browser uses the Web Audio API to pan one track fully left and the other fully right.

## Notes

- Use earphones for the left/right split effect.
- This app is meant for local testing and learning.
- YouTube streaming may be blocked or rate-limited depending on YouTube policy.
