// ── Ludicrous Chronicles — Music Player ──
(function() {
  if (document.getElementById('lc-music-player')) return;

  const DEFAULT_VOL = 0.35;
  const DUCK_VOL    = 0.05;

  let tracks       = [];
  let currentIndex = 0;
  let userVolume   = DEFAULT_VOL;
  let isMuted      = false;
  let isDucked     = false;
  let isPlaying    = false;
  let isOpen       = false;

  const audio = new Audio();
  audio.volume = DEFAULT_VOL;

  // ── CSS ──
  const style = document.createElement('style');
  style.textContent = `
    #lc-music-player {
      position: fixed;
      bottom: 1rem;
      right: 1.5rem;
      z-index: 100000;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    .mp-panel {
      margin-bottom: 0.6rem;
      background: rgba(10,8,6,0.97);
      border: 1px solid var(--border, rgba(201,168,76,0.18));
      padding: 1rem 1.2rem;
      width: 220px;
      box-shadow: 0 6px 28px rgba(0,0,0,0.7);
      animation: mpFadeIn 0.15s ease;
    }
    @keyframes mpFadeIn {
      from { opacity:0; transform: translateY(8px); }
      to   { opacity:1; transform: translateY(0); }
    }
    .mp-now-label {
      font-family: 'Cinzel', serif;
      font-size: 7px;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--gold-dim, #8a6e2f);
      margin-bottom: 0.35rem;
    }
    .mp-title {
      font-family: 'Cinzel', serif;
      font-size: 0.78rem;
      letter-spacing: 0.05em;
      color: var(--parchment, #f5f0e8);
      margin-bottom: 0.1rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mp-artist {
      font-family: 'EB Garamond', serif;
      font-size: 0.8rem;
      font-style: italic;
      color: var(--text-muted, #7a7260);
      margin-bottom: 0.75rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mp-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.3rem;
      margin-bottom: 0.75rem;
    }
    .mp-btn {
      background: none;
      border: 1px solid var(--border, rgba(201,168,76,0.18));
      color: var(--text-muted, #7a7260);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.2s, color 0.2s;
      padding: 0;
    }
    .mp-btn:hover { border-color: var(--gold-dim, #8a6e2f); color: var(--gold, #c9a84c); }
    .mp-btn-skip { width: 24px; height: 24px; }
    .mp-btn-skip svg { width: 11px; height: 11px; fill: currentColor; }
    .mp-btn-skip10 { width: 26px; height: 26px; font-family: "Cinzel", serif; font-size: 8px; letter-spacing: 0; }
    .mp-btn-play { width: 36px; height: 36px; }
    .mp-btn-play svg { width: 14px; height: 14px; fill: currentColor; }
    .mp-btn-play.playing { border-color: var(--gold-dim, #8a6e2f); color: var(--gold, #c9a84c); }
    .mp-volume-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .mp-btn-mute { width: 24px; height: 24px; flex-shrink: 0; }
    .mp-btn-mute svg { width: 11px; height: 11px; fill: currentColor; }
    .mp-volume-slider {
      flex: 1;
      -webkit-appearance: none;
      appearance: none;
      height: 2px;
      background: var(--border, rgba(201,168,76,0.18));
      outline: none;
      cursor: pointer;
    }
    .mp-volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 10px; height: 10px;
      border-radius: 50%;
      background: var(--gold-dim, #8a6e2f);
      cursor: pointer;
      transition: background 0.2s;
    }
    .mp-volume-slider:hover::-webkit-slider-thumb { background: var(--gold, #c9a84c); }
    .mp-volume-slider::-moz-range-thumb {
      width: 10px; height: 10px;
      border-radius: 50%;
      background: var(--gold-dim, #8a6e2f);
      border: none;
      cursor: pointer;
    }
    .mp-empty {
      font-family: 'EB Garamond', serif;
      font-style: italic;
      font-size: 0.8rem;
      color: var(--text-muted, #7a7260);
      text-align: center;
      padding: 0.25rem 0;
    }
    .mp-tracklist-toggle {
      font-family: 'Cinzel', serif;
      font-size: 8px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--text-muted, #7a7260);
      cursor: pointer;
      text-align: center;
      padding: 0.4rem 0 0.2rem;
      transition: color 0.2s;
      border-top: 1px solid var(--border, rgba(201,168,76,0.18));
      margin-top: 0.5rem;
    }
    .mp-tracklist-toggle:hover { color: var(--gold, #c9a84c); }
    .mp-tracklist {
      max-height: 160px;
      overflow-y: auto;
      margin-top: 0.4rem;
      border-top: 1px solid var(--border, rgba(201,168,76,0.18));
      padding-top: 0.4rem;
    }
    .mp-tracklist::-webkit-scrollbar { width: 3px; }
    .mp-tracklist::-webkit-scrollbar-thumb { background: var(--border, rgba(201,168,76,0.18)); }
    .mp-track-item {
      padding: 0.3rem 0;
      border-bottom: 1px solid rgba(201,168,76,0.07);
      cursor: pointer;
      transition: color 0.15s;
    }
    .mp-track-item:last-child { border-bottom: none; }
    .mp-track-item:hover .mp-ti-title { color: var(--gold, #c9a84c); }
    .mp-track-item.active .mp-ti-title { color: var(--gold, #c9a84c); }
    .mp-ti-title {
      font-family: 'Cinzel', serif;
      font-size: 8px;
      letter-spacing: 0.1em;
      color: var(--parchment, #f5f0e8);
      transition: color 0.15s;
    }
    .mp-ti-artist {
      font-family: 'EB Garamond', serif;
      font-style: italic;
      font-size: 0.75rem;
      color: var(--text-muted, #7a7260);
    }
    .mp-toggle {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
      transition: opacity 0.2s, transform 0.2s;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6));
    }
    .mp-toggle:hover { opacity: 1; transform: scale(1.05); }
    .mp-toggle.playing { opacity: 1; }
    .mp-toggle img { width: 44px; height: 44px; object-fit: contain; display: block; }
    @keyframes mpPulse {
      0%, 100% { opacity: 0.7; transform: scale(1); }
      50%       { opacity: 1;   transform: scale(1.1); filter: drop-shadow(0 2px 10px rgba(201,168,76,0.5)); }
    }
    .mp-toggle.mp-pulse { animation: mpPulse 1.8s ease-in-out infinite; }
    @media (max-width: 768px) {
      #lc-music-player { bottom: 0.75rem; right: 0.75rem; }
      .mp-panel { width: 175px; padding: 0.75rem; }
      .mp-toggle { width: 36px; height: 36px; }
      .mp-toggle img { width: 36px; height: 36px; }
    }
  `;
  document.head.appendChild(style);

  // ── Load tracks ──
  async function loadTracks() {
    try {
      const res = await fetch('/_data/music-index.json');
      if (res.ok) {
        const items = await res.json();
        tracks = items
          .filter(t => t.active !== false && t.active !== 'false')
          .sort((a, b) => (parseInt(a.order) || 99) - (parseInt(b.order) || 99));
      }
    } catch(e) {}
  }

  // ── UI refs ──
  let titleEl, artistEl, playBtn, prevBtn, nextBtn, muteBtn, volSlider;

  function updateTrackInfo() {
    if (!tracks.length) {
      if (titleEl) titleEl.textContent = 'No tracks yet';
      if (artistEl) artistEl.textContent = '';
      return;
    }
    const t = tracks[currentIndex];
    if (titleEl)  titleEl.textContent  = t.title  || '—';
    if (artistEl) artistEl.textContent = t.artist || '';
  }

  function setPlaying(state) {
    isPlaying = state;
    if (!playBtn) return;
    playBtn.classList.toggle('playing', state);
    // swap icon
    playBtn.innerHTML = state
      ? `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
      : `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    document.getElementById('lc-music-player')
      ?.querySelector('.mp-toggle')?.classList.toggle('playing', state);
  }

  function playTrack(index) {
    if (!tracks.length) return;
    currentIndex = ((index % tracks.length) + tracks.length) % tracks.length;
    audio.src = tracks[currentIndex].audio || tracks[currentIndex].file || '';
    audio.volume = isMuted ? 0 : (isDucked ? DUCK_VOL : userVolume);
    audio.play().then(() => setPlaying(true)).catch(() => {
      // Don't set isPlaying=false here — browser may just need a moment
      // Only the explicit pause button should mark as not playing
    });
    updateTrackInfo();
  }

  // ── Build widget ──
  function buildWidget() {
    const wrap = document.createElement('div');
    wrap.id = 'lc-music-player';
    wrap.innerHTML = `
      <div class="mp-panel" id="mp-panel" style="display:none;">
        <div class="mp-now-label">Now Playing</div>
        <div class="mp-title" id="mp-title">${tracks.length ? (tracks[0].title || '—') : 'No tracks yet'}</div>
        <div class="mp-artist" id="mp-artist">${tracks.length ? (tracks[0].artist || '') : ''}</div>
        <div class="mp-controls">
          <button class="mp-btn mp-btn-skip" id="mp-prev" title="Previous track">
            <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          <button class="mp-btn mp-btn-skip mp-btn-skip10" id="mp-back10" title="Back 10 seconds">−10</button>
          <button class="mp-btn mp-btn-play" id="mp-play" title="Play / Pause">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button class="mp-btn mp-btn-skip mp-btn-skip10" id="mp-fwd10" title="Forward 10 seconds">+10</button>
          <button class="mp-btn mp-btn-skip" id="mp-next" title="Next track">
            <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zm2.5-6l5.5 4V8l-5.5 4zm7.5-6v12h2V6h-2z"/></svg>
          </button>
        </div>
        <div class="mp-volume-row">
          <button class="mp-btn mp-btn-mute" id="mp-mute" title="Mute / Unmute">
            <svg id="mp-vol-icon" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.8-1-3.3-2.5-4.1v8.2c1.5-.8 2.5-2.3 2.5-4.1z"/></svg>
          </button>
          <input type="range" class="mp-volume-slider" id="mp-vol" min="0" max="1" step="0.02" value="${DEFAULT_VOL}">
        </div>
        <div class="mp-tracklist-toggle" id="mp-tl-toggle">Track List ▾</div>
        <div class="mp-tracklist" id="mp-tracklist" style="display:none;"></div>
      </div>
      <button class="mp-toggle" id="mp-toggle" title="Music Player">
        <img src="images/phonograph.png" alt="Music">
      </button>
    `;
    document.body.appendChild(wrap);

    // Cache refs
    titleEl   = document.getElementById('mp-title');
    artistEl  = document.getElementById('mp-artist');
    playBtn   = document.getElementById('mp-play');
    prevBtn   = document.getElementById('mp-prev');
    nextBtn   = document.getElementById('mp-next');
    muteBtn   = document.getElementById('mp-mute');
    volSlider = document.getElementById('mp-vol');

    const back10 = document.getElementById('mp-back10');
    const fwd10  = document.getElementById('mp-fwd10');

    const panel  = document.getElementById('mp-panel');
    const toggle = document.getElementById('mp-toggle');

    // Toggle panel
    toggle.addEventListener('click', () => {
      isOpen = !isOpen;
      panel.style.display = isOpen ? 'block' : 'none';
    });

    // Play / pause
    playBtn.addEventListener('click', () => {
      if (!tracks.length) return;
      if (isPlaying) {
        audio.pause();
        setPlaying(false);
      } else {
        if (!audio.src || audio.src === window.location.href) {
          playTrack(currentIndex);
        } else {
          audio.play().then(() => setPlaying(true)).catch(() => {});
        }
      }
    });

    prevBtn.addEventListener('click', () => playTrack(currentIndex - 1));
    nextBtn.addEventListener('click', () => playTrack(currentIndex + 1));
    back10.addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
    fwd10.addEventListener('click',  () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });

    // Track list
    const tlToggle  = document.getElementById('mp-tl-toggle');
    const tlPanel   = document.getElementById('mp-tracklist');
    let tlOpen = false;

    function buildTrackList() {
      tlPanel.innerHTML = '';
      tracks.forEach((t, i) => {
        const item = document.createElement('div');
        item.className = 'mp-track-item' + (i === currentIndex ? ' active' : '');
        item.innerHTML = `<div class="mp-ti-title">${t.title || '—'}</div>${t.artist ? `<div class="mp-ti-artist">${t.artist}</div>` : ''}`;
        item.addEventListener('click', () => { playTrack(i); buildTrackList(); });
        tlPanel.appendChild(item);
      });
    }

    tlToggle.addEventListener('click', () => {
      tlOpen = !tlOpen;
      tlPanel.style.display = tlOpen ? 'block' : 'none';
      tlToggle.textContent = tlOpen ? 'Track List ▴' : 'Track List ▾';
      if (tlOpen) buildTrackList();
    });

    // Volume
    volSlider.addEventListener('input', () => {
      userVolume = parseFloat(volSlider.value);
      isMuted = userVolume === 0;
      if (!isDucked) audio.volume = userVolume;
      updateVolIcon();
    });

    // Mute
    muteBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      audio.volume = isMuted ? 0 : (isDucked ? DUCK_VOL : userVolume);
      volSlider.value = isMuted ? 0 : userVolume;
      updateVolIcon();
    });

    updateVolIcon();
  }

  function updateVolIcon() {
    const icon = document.getElementById('mp-vol-icon');
    if (!icon) return;
    if (isMuted || userVolume === 0) {
      icon.innerHTML = `<path d="M16.5 12c0-1.8-1-3.3-2.5-4.1v2.5l2.4 2.4c.1-.3.1-.5.1-.8zm2.5 0c0 .9-.2 1.8-.5 2.6l1.5 1.5C20.6 14.7 21 13.4 21 12c0-4-2.7-7.4-6.5-8.4v2.1c2.4.9 4 3.2 4 6.3zM4.3 3L3 4.3l4.7 4.7H3v6h4l5 5v-6.7l4.2 4.2c-.7.5-1.4.9-2.2 1.1v2.1c1.3-.3 2.5-.9 3.5-1.8l2 2 1.3-1.3-9-9L4.3 3zM12 4L9.9 6.1 12 8.2V4z"/>`;
    } else if (userVolume < 0.5) {
      icon.innerHTML = `<path d="M18.5 12c0-1.8-1-3.3-2.5-4.1v8.2c1.5-.8 2.5-2.3 2.5-4.1zM5 9v6h4l5 5V4L9 9H5z"/>`;
    } else {
      icon.innerHTML = `<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.8-1-3.3-2.5-4.1v8.2c1.5-.8 2.5-2.3 2.5-4.1zM14 3.2v2.1c2.9.9 5 3.6 5 6.7s-2.1 5.8-5 6.7v2.1c4-.9 7-4.5 7-8.8s-3-7.9-7-8.8z"/>`;
    }
  }

  // ── Auto-duck on video play ──
  document.addEventListener('play', e => {
    if (e.target.tagName === 'VIDEO' && !audio.paused) {
      isDucked = true;
      audio.volume = DUCK_VOL;
    }
  }, true);
  document.addEventListener('pause', e => {
    if (e.target.tagName === 'VIDEO') {
      isDucked = false;
      if (!isMuted) audio.volume = userVolume;
    }
  }, true);
  document.addEventListener('ended', e => {
    if (e.target.tagName === 'VIDEO') {
      isDucked = false;
      if (!isMuted) audio.volume = userVolume;
    }
  }, true);

  // ── Next track on end ──
  audio.addEventListener('ended', () => playTrack(currentIndex + 1));

  // ── State persistence ──
  const _SK  = 'lc-music-state';
  const _NAV = 'lc-music-nav'; // timestamp of last internal nav click
  let _savedState = null;

  function saveState() {
    try {
      localStorage.setItem(_SK, JSON.stringify({
        index:   currentIndex,
        time:    audio.currentTime || 0,
        playing: isPlaying
      }));
    } catch(e) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(_SK);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e) { return null; }
  }

  function wasRecentNav() {
    try {
      const ts = localStorage.getItem(_NAV);
      if (!ts) return false;
      const age = Date.now() - parseInt(ts);
      localStorage.removeItem(_NAV);
      return age < 8000; // within 8 seconds of a link click
    } catch(e) { return false; }
  }

  // Intercept internal link clicks — save gesture timestamp so next page can autoplay
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel')) return;
    // Internal navigation — note the gesture and save state
    saveState();
    try { localStorage.setItem(_NAV, Date.now().toString()); } catch(e) {}
  }, true);

  // Save before leaving page
  window.addEventListener('beforeunload', saveState);
  // Also save periodically while playing
  setInterval(() => { if (isPlaying) saveState(); }, 5000);

  // ── Autoplay on first user interaction ──
  let _autoplayArmed = false; // init() will set this based on saved state
  let _autoplayListeners = [];

  function _cleanupAutoplay() {
    _autoplayListeners.forEach(({ evt, fn }) => document.removeEventListener(evt, fn, { passive: true }));
    _autoplayListeners = [];
  }

  function _tryAutoplay() {
    if (!_autoplayArmed || !tracks.length || isPlaying) return;
    _autoplayArmed = false;
    const t = tracks[currentIndex];
    audio.src = t.audio || t.file || '';
    audio.volume = isMuted ? 0 : userVolume;
    // Grab seek time now, clear saved state
    const seekTime = _savedState ? (_savedState.time || 0) : 0;
    _savedState = null;
    // Call play() immediately within the gesture context — seeking after is fine
    audio.play().then(() => {
      setPlaying(true);
      updateTrackInfo();
      if (seekTime > 0) audio.currentTime = seekTime;
      document.getElementById('mp-toggle')?.classList.remove('mp-pulse');
      _cleanupAutoplay();
    }).catch(() => {
      _autoplayArmed = true;
    });
  }

  ['click', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
    const fn = () => _tryAutoplay();
    _autoplayListeners.push({ evt, fn });
    document.addEventListener(evt, fn, { passive: true });
  });

  // ── Init ──
  async function init() {
    await loadTracks();
    buildWidget();

    // Restore saved state
    const recentNav = wasRecentNav();
    _savedState = loadState();
    if (_savedState && tracks.length) {
      currentIndex = Math.min(_savedState.index || 0, tracks.length - 1);
      // Arm autoplay if was playing OR if user just clicked a nav link
      _autoplayArmed = !!_savedState.playing || recentNav;
    } else if (tracks.length) {
      _autoplayArmed = true;
    }
    updateTrackInfo();

    // Admin tier switcher positioning
    function clearTierSwitcher() {
      const switcher = document.getElementById('admin-tier-switcher');
      const player   = document.getElementById('lc-music-player');
      if (switcher && player) {
        const h = switcher.offsetHeight || 80;
        player.style.bottom = (h + 16) + 'px';
      }
    }
    clearTierSwitcher();
    const obs = new MutationObserver(() => { clearTierSwitcher(); obs.disconnect(); });
    obs.observe(document.body, { childList: true, subtree: false });

    // Auto-pause on chapter/story pages so voice acting isn't interrupted
    const path = window.location.pathname.toLowerCase();
    const isStoryPage = /chapter|story/.test(path);
    if (isStoryPage && isPlaying) {
      audio.pause();
      setPlaying(false);
    }
    // Also pause if music starts while already on a story page
    if (isStoryPage) {
      _autoplayArmed = false;
    }

    // Try to play immediately on load
    if (tracks.length && _autoplayArmed) {
      const src = tracks[currentIndex].audio || tracks[currentIndex].file || '';
      audio.src = src;
      audio.volume = isMuted ? 0 : userVolume;

      // Attempt 1: normal autoplay
      audio.play().then(() => {
        setPlaying(true);
        updateTrackInfo();
        _cleanupAutoplay();
      }).catch(() => {
        // Attempt 2: muted autoplay → immediate unmute
        audio.muted = true;
        audio.play().then(() => {
          // Unmute and check it's actually playing audibly
          audio.muted = false;
          audio.volume = isMuted ? 0 : userVolume;
          // Small delay to confirm browser didn't silently kill it
          setTimeout(() => {
            if (!audio.paused && audio.currentTime > 0) {
              setPlaying(true);
              updateTrackInfo();
              _cleanupAutoplay();
            } else {
              // Browser killed it silently — pulse and wait for interaction
              audio.pause();
              document.getElementById('mp-toggle')?.classList.add('mp-pulse');
            }
          }, 300);
        }).catch(() => {
          audio.muted = false;
          document.getElementById('mp-toggle')?.classList.add('mp-pulse');
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
