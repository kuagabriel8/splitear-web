# Split Ear YouTube Player

A web app that lets users enter two YouTube links and play one audio stream in the left ear and the other in the right ear using the YouTube Player API and Web Audio API.

## Setup (Local Development)

1. Open a terminal
2. Run:
   ```bash
   npm install
   npm start
   ```
3. Open `http://localhost:5000` in your browser.

## Deployment to Vercel

1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Vercel will automatically detect the static site and deploy it

## How it works

- The frontend accepts two YouTube URLs and extracts video IDs
- Uses the YouTube IFrame Player API to load videos (muted)
- The browser uses the Web Audio API to pan one track fully left and the other fully right
- No server-side processing required - works entirely in the browser

## Notes

- Use earphones for the left/right split effect
- This app works on any static hosting platform (Vercel, Netlify, GitHub Pages, etc.)
- YouTube videos must allow embedding for this to work
