# Split Ear YouTube Player

A web app that lets users enter two YouTube links and play them synchronized. For stereo separation, use headphones and either:

1. Position yourself so one speaker is near each ear, or
2. Use your device's audio balance/mono controls to route sound appropriately

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
- Uses the YouTube IFrame Player API to load videos
- Videos play in sync using YouTube's API
- Stereo separation achieved through physical positioning or device audio controls

## Notes

- Use headphones for best results
- Videos play simultaneously - separation depends on your audio setup
- This app works on any static hosting platform (Vercel, Netlify, GitHub Pages, etc.)
- YouTube videos must allow embedding for this to work
