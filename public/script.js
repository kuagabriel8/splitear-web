const leftUrlInput = document.querySelector('#leftUrl');
const rightUrlInput = document.querySelector('#rightUrl');
const loadButton = document.querySelector('#loadButton');
const playButton = document.querySelector('#playButton');
const clearButton = document.querySelector('#clearButton');
const toastContainer = document.querySelector('#toastContainer');

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
  setTimeout(() => toast.remove(), 3600);
}

function setStatus(message, type = 'info') {
  showToast(message, type);
}

function isSameLinks(leftUrl, rightUrl) {
  return previousLeftUrl === leftUrl && previousRightUrl === rightUrl;
}

function restartAudio() {
  try {
    if (leftAudio) { leftAudio.pause(); leftAudio.currentTime = 0; }
    if (rightAudio) { rightAudio.pause(); rightAudio.currentTime = 0; }
    isPlaying = false;
    playButton.textContent = 'Play';
    setStatus('Tracks reset. Click Play to begin.', 'info');
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
  setStatus('Links cleared. Enter two new audio URLs.', 'info');
}

async function createTrack(url, panValue) {
  const audio = document.createElement('audio');
  audio.crossOrigin = 'anonymous';
  audio.preload = 'auto';
  audio.src = url;

  return new Promise((resolve, reject) => {
    let isResolved = false;
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        reject(new Error('Audio load timed out.'));
      }
    }, 60000);

    const onCanPlay = () => {
      if (isResolved) return;
      cleanup();
      try {
        const source = audioContext.createMediaElementSource(audio);
        const panner = audioContext.createStereoPanner();
        panner.pan.value = panValue;
        source.connect(panner).connect(audioContext.destination);
        isResolved = true;
        resolve({ audio, source, panner });
      } catch (err) {
        isResolved = true;
        reject(new Error('Failed to set up audio pipeline: ' + err.message));
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
    audio.load();
  });
}

async function loadTracks() {
  const leftUrl = leftUrlInput.value.trim();
  const rightUrl = rightUrlInput.value.trim();

  if (!leftUrl || !rightUrl) {
    setStatus('Please enter both audio URLs.', 'error');
    return;
  }

  if (leftUrl === rightUrl) {
    setStatus('Use two different audio URLs.', 'error');
    return;
  }

  if (isSameLinks(leftUrl, rightUrl) && leftAudio && rightAudio) {
    restartAudio();
    return;
  }

  cleanupTracks();
  await new Promise(resolve => setTimeout(resolve, 300));

  setStatus('Loading tracks...', 'info');
  loadButton.disabled = true;
  playButton.disabled = true;

  try {
    const [leftTrack, rightTrack] = await Promise.all([
      createTrack(leftUrl, -1),
      createTrack(rightUrl, 1),
    ]);

    leftAudio = leftTrack.audio;
    leftSource = leftTrack.source;
    leftPanner = leftTrack.panner;
    rightAudio = rightTrack.audio;
    rightSource = rightTrack.source;
    rightPanner = rightTrack.panner;

    previousLeftUrl = leftUrl;
    previousRightUrl = rightUrl;

    setStatus('Tracks loaded. Click Play to begin.', 'success');
    playButton.disabled = false;
  } catch (error) {
    console.error(error);
    cleanupTracks();
    setStatus('Unable to load one or both tracks. Check that the URLs are direct audio files with CORS enabled.', 'error');
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
