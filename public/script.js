const leftUrlInput = document.querySelector('#leftUrl');
const rightUrlInput = document.querySelector('#rightUrl');
const loadButton = document.querySelector('#loadButton');
const playButton = document.querySelector('#playButton');
const clearButton = document.querySelector('#clearButton');
const toastContainer = document.querySelector('#toastContainer');
const previewLeftThumb = document.querySelector('#previewLeftThumb');
const previewRightThumb = document.querySelector('#previewRightThumb');
const previewLeftOverlay = document.querySelector('#previewLeftOverlay');
const previewRightOverlay = document.querySelector('#previewRightOverlay');

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let leftPlayer = null;
let rightPlayer = null;
let leftSource = null;
let rightSource = null;
let leftPanner = null;
let rightPanner = null;
let isPlaying = false;
let previousLeftUrl = null;
let previousRightUrl = null;

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3600);
}

function setStatus(message, type = 'info') {
  showToast(message, type);
}

function extractYouTubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.slice(1);
    }
    return parsed.searchParams.get('v');
  } catch {
    return null;
  }
}

function getThumbnailUrl(url) {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}

function updatePreviewThumbnails() {
  const leftThumb = getThumbnailUrl(leftUrlInput.value.trim());
  const rightThumb = getThumbnailUrl(rightUrlInput.value.trim());

  if (leftThumb) {
    previewLeftThumb.src = leftThumb;
    previewLeftOverlay.style.display = 'block';
  } else {
    previewLeftThumb.src = '';
    previewLeftOverlay.style.display = 'none';
  }

  if (rightThumb) {
    previewRightThumb.src = rightThumb;
    previewRightOverlay.style.display = 'block';
  } else {
    previewRightThumb.src = '';
    previewRightOverlay.style.display = 'none';
  }
}

function isSameLinks(leftUrl, rightUrl) {
  return previousLeftUrl === leftUrl && previousRightUrl === rightUrl;
}

function restartAudio() {
  try {
    if (leftPlayer) {
      leftPlayer.seekTo(0);
    }
    if (rightPlayer) {
      rightPlayer.seekTo(0);
    }
    isPlaying = false;
    playButton.textContent = 'Play';
    setStatus('Audio restarted. Click Play to begin.', 'success');
  } catch (error) {
    console.error('Error restarting audio:', error);
    setStatus('Error restarting audio.', 'error');
  }
}

function cleanupTracks() {
  const cleanup = (player, source, panner) => {
    if (!player) return;
    try {
      player.pauseVideo();
      player.seekTo(0);
      source?.disconnect();
      panner?.disconnect();
    } catch (error) {
      console.warn('Player cleanup error:', error);
    }
  };

  cleanup(leftPlayer, leftSource, leftPanner);
  cleanup(rightPlayer, rightSource, rightPanner);

  leftPlayer = null;
  rightPlayer = null;
  leftSource = null;
  rightSource = null;
  leftPanner = null;
  rightPanner = null;
  isPlaying = false;
  playButton.textContent = 'Play';
  playButton.disabled = true;
}

function clearTracks() {
  cleanupTracks();
  leftUrlInput.value = '';
  rightUrlInput.value = '';
  previousLeftUrl = null;
  previousRightUrl = null;
  updatePreviewThumbnails();
  setStatus('Links cleared. Enter two new YouTube links.', 'info');
}

async function createTrack(videoId, panValue) {
  return new Promise((resolve, reject) => {
    const playerDiv = document.createElement('div');
    playerDiv.style.display = 'none';
    document.body.appendChild(playerDiv);

    const player = YouTubePlayer(playerDiv, {
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        showinfo: 0,
      },
    });

    let isResolved = false;
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        reject(new Error('YouTube player load timed out.'));
      }
    }, 30000);

    const cleanup = () => {
      clearTimeout(timeout);
      player.destroy();
      playerDiv.remove();
    };

    player.on('ready', () => {
      try {
        // Get the video element from the player
        const iframe = playerDiv.querySelector('iframe');
        if (!iframe) {
          isResolved = true;
          cleanup();
          reject(new Error('Could not find YouTube iframe.'));
          return;
        }

        const videoElement = iframe.contentWindow.document.querySelector('video');
        if (!videoElement) {
          isResolved = true;
          cleanup();
          reject(new Error('Could not find YouTube video element.'));
          return;
        }

        // Create Web Audio source from the video element
        const source = audioContext.createMediaElementSource(videoElement);
        const panner = audioContext.createStereoPanner();
        panner.pan.value = panValue;
        source.connect(panner).connect(audioContext.destination);

        // Mute the video element since we're using Web Audio
        videoElement.muted = true;
        videoElement.volume = 0;

        isResolved = true;
        clearTimeout(timeout);
        resolve({ player, source, panner });
      } catch (error) {
        isResolved = true;
        cleanup();
        reject(new Error('Failed to setup Web Audio: ' + error.message));
      }
    });

    player.on('error', (error) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        reject(new Error('YouTube player error: ' + error.data));
      }
    });
  });
}

async function loadTracks() {
  const leftUrl = leftUrlInput.value.trim();
  const rightUrl = rightUrlInput.value.trim();

  if (!leftUrl || !rightUrl) {
    setStatus('Please enter both YouTube links.', 'error');
    return;
  }

  if (leftUrl === rightUrl) {
    setStatus('Use two different YouTube links.', 'error');
    return;
  }

  updatePreviewThumbnails();

  // If same links were already loaded for left and right tracks, just restart audio instead of reloading
  if (isSameLinks(leftUrl, rightUrl) && leftPlayer && rightPlayer) {
    restartAudio();
    return;
  }

  cleanupTracks();

  // Buffer time to allow browser to release resources
  await new Promise(resolve => setTimeout(resolve, 500));

  setStatus('Loading tracks...', 'info');
  loadButton.disabled = true;
  playButton.disabled = true;

  try {
    const leftVideoId = extractYouTubeId(leftUrl);
    const rightVideoId = extractYouTubeId(rightUrl);

    if (!leftVideoId || !rightVideoId) {
      throw new Error('Invalid YouTube URLs. Please check the links.');
    }

    const leftPromise = createTrack(leftVideoId, -1);
    const rightPromise = createTrack(rightVideoId, 1);

    const [leftTrack, rightTrack] = await Promise.all([leftPromise, rightPromise]);

    leftPlayer = leftTrack.player;
    leftSource = leftTrack.source;
    leftPanner = leftTrack.panner;

    rightPlayer = rightTrack.player;
    rightSource = rightTrack.source;
    rightPanner = rightTrack.panner;

    // Store the loaded URLs for future comparison
    previousLeftUrl = leftUrl;
    previousRightUrl = rightUrl;

    setStatus('Tracks loaded. Click Play to begin.', 'success');
    playButton.disabled = false;
  } catch (error) {
    console.error(error);
    cleanupTracks();
    setStatus('Unable to load one or both tracks. Check the URLs and try again.', 'error');
  } finally {
    loadButton.disabled = false;
  }
}

async function togglePlay() {
  if (!leftPlayer || !rightPlayer) {
    setStatus('No tracks are loaded yet.', 'error');
    return;
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  if (!isPlaying) {
    await Promise.all([
      leftPlayer.playVideo(),
      rightPlayer.playVideo()
    ]);
    playButton.textContent = 'Pause';
    setStatus('Playing in left and right ears.', 'success');
    isPlaying = true;
  } else {
    leftPlayer.pauseVideo();
    rightPlayer.pauseVideo();
    playButton.textContent = 'Play';
    setStatus('Paused.', 'info');
    isPlaying = false;
  }
}

loadButton.addEventListener('click', loadTracks);
playButton.addEventListener('click', togglePlay);
clearButton.addEventListener('click', clearTracks);
leftUrlInput.addEventListener('input', updatePreviewThumbnails);
rightUrlInput.addEventListener('input', updatePreviewThumbnails);
