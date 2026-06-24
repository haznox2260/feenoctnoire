// =============================================================================
//  FÉE NOIRE — music-player.js  (Phiên bản: Static Files + Shuffle + Xuyên Trang)
//
//  Cách dùng:
//  1. Bỏ file MP3 vào thư mục /music/
//  2. Khai báo danh sách trong window.FN_TRACKS (xem ví dụ dưới)
//  3. Nhúng vào TẤT CẢ trang trước </body>, SAU auth.js
//
//  Ví dụ khai báo (trong config.js hoặc thẻ <script> trước file này):
//  window.FN_TRACKS = [
//    { id: 'track_1', title: 'Em Thua Cô Ta (ACV Remix #2)', src: 'music/Em Thua Cô Ta (ACV Remix #2).mp3' },
//    { id: 'track_2', title: 'Alex Morgan Phonk Brazilian', src: 'music/alex-morgan-phonk-brazilian-.mp3' },
//  ];
// =============================================================================
(function () {

  // ── TRACKS — đọc từ window.FN_TRACKS ────────────────────────────────────────
  const TRACKS_DEF = Array.isArray(window.FN_TRACKS) ? window.FN_TRACKS : [];

  // ── State localStorage ──────────────────────────────────────────────────────
  const STATE_KEY = 'fn_music_v4';
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY)) || {}; } catch { return {}; }
  }
  function saveState(patch) {
    const s = Object.assign(loadState(), patch);
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  }

  // ── Phân quyền ─────────────────────────────────────────────────────────────
  function isAdmin() {
    try {
      const s = JSON.parse(sessionStorage.getItem('fee_noire_session'));
      return s && s.role === 'admin';
    } catch { return false; }
  }

  // ── CSS ────────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #fnMusicBar {
      position: fixed; bottom: 24px; left: 50%;
      transform: translateX(-50%) translateY(0);
      z-index: 3000; display: flex; align-items: center; gap: 10px;
      background: rgba(14,11,20,0.92);
      border: 1px solid rgba(187,134,252,0.3); border-radius: 40px;
      padding: 9px 16px 9px 14px;
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 20px rgba(187,134,252,0.08);
      transition: opacity 0.35s ease, transform 0.35s ease;
      min-width: 300px; max-width: 92vw; opacity: 1;
    }
    #fnMusicBar.bar-hidden {
      opacity: 0; pointer-events: none;
      transform: translateX(-50%) translateY(20px);
    }
    #fnMusicBar.bar-empty { display: none !important; }

    #fnMusicMini {
      position: fixed; right: 18px; top: 50%;
      z-index: 3000; width: 48px; height: 48px; border-radius: 50%;
      border: 1px solid rgba(187,134,252,0.5);
      background: rgba(14,11,20,0.92); color: #bb86fc; font-size: 1.1rem;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 14px rgba(187,134,252,0.2);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      transition: opacity 0.35s ease, transform 0.35s ease, box-shadow 0.25s ease;
      opacity: 0; pointer-events: none;
      transform: translateY(-50%) scale(0.6);
    }
    #fnMusicMini.mini-visible {
      opacity: 1; pointer-events: all; transform: translateY(-50%) scale(1);
    }
    #fnMusicMini:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 22px rgba(187,134,252,0.4); }
    #fnMusicMini.playing::after {
      content:''; position:absolute; inset:-5px; border-radius:50%;
      border:1px solid rgba(187,134,252,0.4);
      animation: fnMiniPulse 1.8s ease-in-out infinite;
    }
    @keyframes fnMiniPulse {
      0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:0;transform:scale(1.35)}
    }

    .fn-mb-play {
      width:36px;height:36px;border-radius:50%;
      border:1px solid rgba(187,134,252,0.45); background:rgba(187,134,252,0.12);
      color:#bb86fc;font-size:.85rem;display:flex;align-items:center;
      justify-content:center;cursor:pointer;transition:all .2s;flex-shrink:0;
    }
    .fn-mb-play:hover{background:rgba(187,134,252,0.25);box-shadow:0 0 12px rgba(187,134,252,.3);}

    .fn-mb-info{flex:1;overflow:hidden;min-width:0;}
    .fn-mb-title{
      font-size:.78rem;color:rgba(245,246,250,.9);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      font-family:'Quicksand',sans-serif;
    }
    .fn-mb-bar-track{
      width:100%;height:3px;background:rgba(255,255,255,.1);
      border-radius:2px;margin-top:4px;overflow:hidden;cursor:pointer;
    }
    .fn-mb-bar-fill{
      height:100%;width:0%;
      background:linear-gradient(90deg,#bb86fc,#03dac6);
      border-radius:2px;transition:width .5s linear;
    }
    .fn-mb-icon-btn {
      width:28px;height:28px;border-radius:50%;border:none;
      background:transparent;color:rgba(187,134,252,.6);font-size:.8rem;
      cursor:pointer;display:flex;align-items:center;justify-content:center;
      transition:color .2s;flex-shrink:0;
    }
    .fn-mb-icon-btn:hover{color:#bb86fc;}
    .fn-mb-icon-btn.active{color:#03dac6;}

    .fn-mb-close {
      width:22px;height:22px;border-radius:50%;border:none;
      background:rgba(255,71,87,.15);color:rgba(255,71,87,.7);
      font-size:.65rem;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      transition:all .2s;flex-shrink:0;
    }
    .fn-mb-close:hover{background:rgba(255,71,87,.3);color:#ff4757;}

    .fn-mb-eq{display:flex;align-items:flex-end;gap:2px;height:16px;flex-shrink:0;}
    .fn-mb-eq span{width:3px;background:#bb86fc;border-radius:1px;
      animation:fnEqBounce .8s ease-in-out infinite;}
    .fn-mb-eq span:nth-child(2){animation-delay:.15s;}
    .fn-mb-eq span:nth-child(3){animation-delay:.3s;}
    .fn-mb-eq.paused span{animation-play-state:paused;height:4px!important;}
    @keyframes fnEqBounce{0%,100%{height:4px}50%{height:14px}}
  `;
  document.head.appendChild(style);

  // ── HTML BAR ────────────────────────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.id = 'fnMusicBar';
  bar.innerHTML = `
    <button class="fn-mb-play" id="fnMbPlay" title="Phát / Dừng">
      <i class="fa-solid fa-play" id="fnMbPlayIcon"></i>
    </button>
    <div class="fn-mb-eq" id="fnMbEq"><span></span><span></span><span></span></div>
    <div class="fn-mb-info">
      <div class="fn-mb-title" id="fnMbTitle">—</div>
      <div class="fn-mb-bar-track" id="fnMbTrack">
        <div class="fn-mb-bar-fill" id="fnMbFill"></div>
      </div>
    </div>
    <button class="fn-mb-icon-btn" id="fnMbShuffle" title="Trộn bài">
      <i class="fa-solid fa-shuffle"></i>
    </button>
    <button class="fn-mb-icon-btn" id="fnMbPrev" title="Bài trước">
      <i class="fa-solid fa-backward-step"></i>
    </button>
    <button class="fn-mb-icon-btn" id="fnMbNext" title="Bài tiếp">
      <i class="fa-solid fa-forward-step"></i>
    </button>
    <button class="fn-mb-icon-btn" id="fnMbVol" title="Tắt / Bật tiếng">
      <i class="fa-solid fa-volume-high" id="fnMbVolIcon"></i>
    </button>
    <button class="fn-mb-close" id="fnMbClose" title="Thu gọn"><i class="fa-solid fa-xmark"></i></button>
  `;
  document.body.appendChild(bar);

  const mini = document.createElement('button');
  mini.id = 'fnMusicMini';
  mini.title = 'Mở nhạc';
  mini.innerHTML = '<i class="fa-solid fa-music"></i>';
  document.body.appendChild(mini);

  // ── REFS ────────────────────────────────────────────────────────────────────
  const playBtn    = document.getElementById('fnMbPlay');
  const playIcon   = document.getElementById('fnMbPlayIcon');
  const eqEl       = document.getElementById('fnMbEq');
  const titleEl    = document.getElementById('fnMbTitle');
  const fillEl     = document.getElementById('fnMbFill');
  const trackBar   = document.getElementById('fnMbTrack');
  const prevBtn    = document.getElementById('fnMbPrev');
  const nextBtn    = document.getElementById('fnMbNext');
  const shuffleBtn = document.getElementById('fnMbShuffle');
  const volBtn     = document.getElementById('fnMbVol');
  const volIcon    = document.getElementById('fnMbVolIcon');
  const closeBtn   = document.getElementById('fnMbClose');

  // ── RUNTIME STATE ───────────────────────────────────────────────────────────
  let TRACKS       = TRACKS_DEF.slice();
  let shuffleOrder = [];
  let currentIdx   = 0;
  let isPlaying    = false;
  let isMuted      = false;
  let isMinimized  = false;
  let isShuffle    = false;

  const audio = new Audio();
  audio.volume = 0.4;

  // ── SHUFFLE ─────────────────────────────────────────────────────────────────
  function buildShuffleOrder(keepRealIdx) {
    const arr = TRACKS.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (keepRealIdx !== undefined) {
      const pos = arr.indexOf(keepRealIdx);
      if (pos > 0) { [arr[0], arr[pos]] = [arr[pos], arr[0]]; }
    }
    return arr;
  }

  function currentTrackRealIdx() {
    return isShuffle ? shuffleOrder[currentIdx] : currentIdx;
  }

  // ── UI ───────────────────────────────────────────────────────────────────────
  function syncUI() {
    playIcon.className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    isPlaying ? eqEl.classList.remove('paused') : eqEl.classList.add('paused');
    mini.classList.toggle('playing', isPlaying);
    mini.querySelector('i').className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-music';
    volIcon.className = isMuted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
    shuffleBtn.classList.toggle('active', isShuffle);
  }

  function setMinimized(val) {
    isMinimized = val;
    bar.classList.toggle('bar-hidden', val);
    mini.classList.toggle('mini-visible', val);
    saveState({ minimized: val });
  }

  // ── AUDIO ────────────────────────────────────────────────────────────────────
  function loadTrack(posInOrder, seekTo) {
    if (!TRACKS.length) return;
    const total = isShuffle ? shuffleOrder.length : TRACKS.length;
    currentIdx = ((posInOrder % total) + total) % total;
    const t = TRACKS[currentTrackRealIdx()];
    if (!t) return;
    audio.src = t.src;
    if (seekTo > 0) {
      audio.addEventListener('loadedmetadata', function onMeta() {
        audio.currentTime = seekTo;
        audio.removeEventListener('loadedmetadata', onMeta);
      });
    }
    titleEl.textContent = t.title;
    fillEl.style.width  = '0%';
    saveState({ trackId: t.id, time: 0, shuffleOrder: isShuffle ? shuffleOrder : null });
  }

  function play() {
    if (!TRACKS.length) return;
    audio.play()
      .then(() => { isPlaying = true; syncUI(); saveState({ playing: true }); })
      .catch(() => {});
  }
  function pause() {
    audio.pause(); isPlaying = false; syncUI(); saveState({ playing: false });
  }

  function skipTo(pos) { loadTrack(pos); if (isPlaying) play(); }

  function nextTrack() {
    const total = isShuffle ? shuffleOrder.length : TRACKS.length;
    const next  = currentIdx + 1;
    if (next >= total && isShuffle) {
      shuffleOrder = buildShuffleOrder();
      saveState({ shuffleOrder });
      skipTo(0);
    } else {
      skipTo(next);
    }
  }

  // ── EVENTS ───────────────────────────────────────────────────────────────────
  audio.addEventListener('timeupdate', () => {
    if (audio.duration) fillEl.style.width = (audio.currentTime / audio.duration * 100) + '%';
    const now = Math.floor(audio.currentTime);
    if (now !== (loadState()._lastSavedSec || -1)) saveState({ time: audio.currentTime, _lastSavedSec: now });
  });
  audio.addEventListener('ended', nextTrack);

  window.addEventListener('beforeunload', () => {
    saveState({ time: audio.currentTime, playing: isPlaying, muted: isMuted });
  });

  trackBar.addEventListener('click', e => {
    if (!audio.duration) return;
    const rect = trackBar.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  });

  playBtn.addEventListener('click',   () => { isPlaying ? pause() : play(); });
  prevBtn.addEventListener('click',   () => { skipTo(currentIdx - 1); });
  nextBtn.addEventListener('click',   nextTrack);

  shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    if (isShuffle) {
      shuffleOrder = buildShuffleOrder(currentTrackRealIdx());
      currentIdx = 0;
      saveState({ shuffle: true, shuffleOrder });
    } else {
      currentIdx = currentTrackRealIdx();
      saveState({ shuffle: false, shuffleOrder: null });
    }
    syncUI();
  });

  volBtn.addEventListener('click', () => {
    isMuted = !isMuted; audio.muted = isMuted; syncUI(); saveState({ muted: isMuted });
  });

  closeBtn.addEventListener('click', () => setMinimized(true));
  mini.addEventListener('click', () => {
    setMinimized(false);
    if (!isPlaying) play();
  });

  // ── INIT ─────────────────────────────────────────────────────────────────────
  function initPlayer() {
    if (!TRACKS.length) {
      bar.classList.add('bar-empty');
      return;
    }

    const st   = loadState();
    isMuted    = !!st.muted;
    isShuffle  = !!st.shuffle;
    isMinimized = !!st.minimized;
    audio.muted = isMuted;

    if (isShuffle && Array.isArray(st.shuffleOrder) && st.shuffleOrder.length === TRACKS.length) {
      shuffleOrder = st.shuffleOrder;
    } else if (isShuffle) {
      shuffleOrder = buildShuffleOrder();
    }

    let startPos = 0;
    if (st.trackId) {
      const realIdx = TRACKS.findIndex(t => t.id === st.trackId);
      if (realIdx !== -1) startPos = isShuffle ? (shuffleOrder.indexOf(realIdx) || 0) : realIdx;
    }

    loadTrack(startPos, st.time || 0);
    if (isMinimized) setMinimized(true);
    syncUI();

    if (st.playing) {
      audio.play()
        .then(() => { isPlaying = true; syncUI(); })
        .catch(() => {
          const resume = () => {
            audio.play().then(() => { isPlaying = true; syncUI(); saveState({ playing: true }); }).catch(() => {});
            document.removeEventListener('click',   resume);
            document.removeEventListener('keydown', resume);
          };
          document.addEventListener('click',   resume, { once: true });
          document.addEventListener('keydown', resume, { once: true });
        });
    }
  }

  window.addEventListener('fn:authChanged', () => {}); // giữ compatibility
  initPlayer();

})();
