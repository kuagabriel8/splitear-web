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
let leftAudio = null;
let rightAudio = null;
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
    if (leftAudio) {
      leftAudio.currentTime = 0;
    }
    if (rightAudio) {
      rightAudio.currentTime = 0;
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
  const cleanup = (audio, source, panner) => {
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
      audio.load();
      source?.disconnect();
      panner?.disconnect();
    } catch (error) {
      console.warn('Audio cleanup error:', error);
    }
  };

  cleanup(leftAudio, leftSource, leftPanner);
  cleanup(rightAudio, rightSource, rightPanner);

  leftAudio = null;
  rightAudio = null;
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

async function createTrack(url, panValue) {
  const audio = document.createElement('audio');
  audio.crossOrigin = 'anonymous';
  audio.preload = 'auto';
  audio.loop = true;
  audio.muted = true;
  audio.volume = 0;
  audio.src = url;

  return new Promise((resolve, reject) => {
    let isResolved = false;
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        reject(new Error('Audio load timed out.'));
      }
    }, 600000);

    const onCanPlay = async () => {
      if (isResolved) return;
      cleanup();

      try {
        await audio.play();
        audio.pause();
        isResolved = true;
        
        audio.muted = false;
        audio.volume = 1;

        const source = audioContext.createMediaElementSource(audio);
        const panner = audioContext.createStereoPanner();
        panner.pan.value = panValue;
        source.connect(panner).connect(audioContext.destination);

        resolve({ audio, source, panner });
      } catch (playError) {
        isResolved = true;
        reject(new Error('Audio is not playable yet.'));
      }
    };

    const onError = () => {
      if (isResolved) return;
      isResolved = true;
      cleanup();
      const code = audio.error && audio.error.code;
      reject(new Error(`Failed to load audio. code=${code || 'unknown'}`));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
    };

    audio.addEventListener('canplay', onCanPlay, { once: true });
    audio.addEventListener('error', onError, { once: true });
    
    try {
      audio.load();
    } catch (err) {
      isResolved = true;
      cleanup();
      reject(new Error(`Audio load error: ${err.message}`));
    }
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
  if (isSameLinks(leftUrl, rightUrl) && leftAudio && rightAudio) {
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
    const leftPromise = createTrack(`/api/audio?url=${encodeURIComponent(leftUrl)}`, -1);
    const rightPromise = createTrack(`/api/audio?url=${encodeURIComponent(rightUrl)}`, 1);

    const [leftTrack, rightTrack] = await Promise.all([leftPromise, rightPromise]);

    leftAudio = leftTrack.audio;
    leftSource = leftTrack.source;
    leftPanner = leftTrack.panner;

    rightAudio = rightTrack.audio;
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
  if (!leftAudio || !rightAudio) {
    setStatus('No tracks are loaded yet.', 'error');
    return;
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  if (!isPlaying) {
    await Promise.all([leftAudio.play(), rightAudio.play()]);
    playButton.textContent = 'Pause';
    setStatus('Playing in left and right ears.', 'success');
    isPlaying = true;
  } else {
    leftAudio.pause();
    rightAudio.pause();
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
