// =============================================================================
//  FÉE NOIRE — music-player.js
//  Nhúng vào TẤT CẢ trang (trước </body>).
//  Nhạc tiếp tục phát khi chuyển trang, dừng khi người dùng bấm nút.
//  Thu gọn thành nút nhỏ góc phải giữa màn hình khi bấm X.
// =============================================================================
(function () {

  // ── CẤU HÌNH ─────────────────────────────────────────────────────────────
  const TRACKS = [
    {
      title: 'Mystic Night — Fée Noire',
      src: 'alex-morgan-phonk-brazilian-phonk-phonk-music-545509.mp3'
    },
    {
      title: 'Celestial Dream',
      src: 'https://cdn.pixabay.com/audio/2022/10/30/audio_b17b1d2a67.mp3'
    },
    {
      title: 'Starlight Journey',
      src: 'https://cdn.pixabay.com/audio/2023/03/28/audio_b2a53c5440.mp3'
    }
  ];

  const STATE_KEY = 'fn_music_state';

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY)) || {}; }
    catch (_) { return {}; }
  }
  function saveState(patch) {
    const s = Object.assign(loadState(), patch);
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* ── BAR ĐẦY ĐỦ ── */
    #fnMusicBar {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(0);
      z-index: 3000;
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(14, 11, 20, 0.90);
      border: 1px solid rgba(187, 134, 252, 0.3);
      border-radius: 40px;
      padding: 9px 16px 9px 14px;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 20px rgba(187,134,252,0.08);
      transition: opacity 0.35s ease, transform 0.35s ease;
      min-width: 260px;
      max-width: 92vw;
      opacity: 1;
    }
    #fnMusicBar.bar-hidden {
      opacity: 0;
      pointer-events: none;
      transform: translateX(-50%) translateY(20px);
    }

    /* ── NÚT NHỎ THU GỌN ── */
    #fnMusicMini {
      position: fixed;
      right: 18px;
      top: 50%;
      transform: translateY(-50%) scale(0.6);
      z-index: 3000;
      width: 48px; height: 48px;
      border-radius: 50%;
      border: 1px solid rgba(187,134,252,0.5);
      background: rgba(14,11,20,0.92);
      color: #bb86fc;
      font-size: 1.1rem;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 14px rgba(187,134,252,0.2);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      transition: opacity 0.35s ease, transform 0.35s ease, box-shadow 0.25s ease;
      opacity: 0;
      pointer-events: none;
    }
    #fnMusicMini.mini-visible {
      opacity: 1;
      pointer-events: all;
      transform: translateY(-50%) scale(1);
    }
    #fnMusicMini:hover {
      box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 22px rgba(187,134,252,0.4);
    }
    /* Vòng pulse khi đang phát */
    #fnMusicMini.playing::after {
      content: '';
      position: absolute;
      inset: -5px;
      border-radius: 50%;
      border: 1px solid rgba(187,134,252,0.4);
      animation: fnMiniPulse 1.8s ease-in-out infinite;
    }
    @keyframes fnMiniPulse {
      0%,100% { opacity:0.6; transform: scale(1); }
      50%      { opacity:0;   transform: scale(1.35); }
    }

    /* ── CONTROLS CHUNG ── */
    .fn-mb-play {
      width: 36px; height: 36px;
      border-radius: 50%;
      border: 1px solid rgba(187,134,252,0.45);
      background: rgba(187,134,252,0.12);
      color: #bb86fc;
      font-size: 0.85rem;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .fn-mb-play:hover { background: rgba(187,134,252,0.25); box-shadow: 0 0 12px rgba(187,134,252,0.3); }

    .fn-mb-info { flex: 1; overflow: hidden; }
    .fn-mb-title {
      font-size: 0.78rem;
      color: rgba(245,246,250,0.9);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      font-family: 'Quicksand', sans-serif;
    }
    .fn-mb-bar-track {
      width: 100%; height: 3px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px; margin-top: 4px; overflow: hidden; cursor: pointer;
    }
    .fn-mb-bar-fill {
      height: 100%; width: 0%;
      background: linear-gradient(90deg, #bb86fc, #03dac6);
      border-radius: 2px; transition: width 0.5s linear;
    }
    .fn-mb-vol, .fn-mb-next {
      width: 28px; height: 28px; border-radius: 50%; border: none;
      background: transparent; color: rgba(187,134,252,0.6); font-size: 0.8rem;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: color 0.2s; flex-shrink: 0;
    }
    .fn-mb-vol:hover, .fn-mb-next:hover { color: #bb86fc; }

    /* Nút X nhỏ gọn */
    .fn-mb-close {
      width: 22px; height: 22px; border-radius: 50%; border: none;
      background: rgba(255,71,87,0.15); color: rgba(255,71,87,0.7);
      font-size: 0.65rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; flex-shrink: 0;
    }
    .fn-mb-close:hover { background: rgba(255,71,87,0.3); color: #ff4757; }

    /* Equalizer */
    .fn-mb-eq {
      display: flex; align-items: flex-end; gap: 2px; height: 16px; flex-shrink: 0;
    }
    .fn-mb-eq span {
      width: 3px; background: #bb86fc; border-radius: 1px;
      animation: fnEqBounce 0.8s ease-in-out infinite;
    }
    .fn-mb-eq span:nth-child(2) { animation-delay: 0.15s; }
    .fn-mb-eq span:nth-child(3) { animation-delay: 0.3s; }
    .fn-mb-eq.paused span { animation-play-state: paused; height: 4px !important; }
    @keyframes fnEqBounce { 0%,100% { height: 4px; } 50% { height: 14px; } }
  `;
  document.head.appendChild(style);

  // ── HTML BAR ──────────────────────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.id = 'fnMusicBar';
  bar.innerHTML = `
    <button class="fn-mb-play" id="fnMbPlay" title="Phát / Dừng">
      <i class="fa-solid fa-play" id="fnMbPlayIcon"></i>
    </button>
    <div class="fn-mb-eq" id="fnMbEq"><span></span><span></span><span></span></div>
    <div class="fn-mb-info">
      <div class="fn-mb-title" id="fnMbTitle">Fée Noire Music</div>
      <div class="fn-mb-bar-track" id="fnMbTrack">
        <div class="fn-mb-bar-fill" id="fnMbFill"></div>
      </div>
    </div>
    <button class="fn-mb-next" id="fnMbNext" title="Bài tiếp theo">
      <i class="fa-solid fa-forward-step"></i>
    </button>
    <button class="fn-mb-vol" id="fnMbVol" title="Tắt / Bật âm lượng">
      <i class="fa-solid fa-volume-high" id="fnMbVolIcon"></i>
    </button>
    <button class="fn-mb-close" id="fnMbClose" title="Thu gọn">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;
  document.body.appendChild(bar);

  // ── HTML NÚT NHỎ ─────────────────────────────────────────────────────────
  const mini = document.createElement('button');
  mini.id = 'fnMusicMini';
  mini.title = 'Mở nhạc';
  mini.innerHTML = '<i class="fa-solid fa-music"></i>';
  document.body.appendChild(mini);

  // ── AUDIO ─────────────────────────────────────────────────────────────────
  const audio = new Audio();
  audio.loop = false;
  audio.volume = 0.4;
  audio.crossOrigin = 'anonymous';

  let currentTrack = 0;
  let isPlaying = false;
  let isMuted    = false;
  let isMinimized = false;

  const playBtn  = document.getElementById('fnMbPlay');
  const playIcon = document.getElementById('fnMbPlayIcon');
  const eqEl     = document.getElementById('fnMbEq');
  const titleEl  = document.getElementById('fnMbTitle');
  const fillEl   = document.getElementById('fnMbFill');
  const nextBtn  = document.getElementById('fnMbNext');
  const volBtn   = document.getElementById('fnMbVol');
  const volIcon  = document.getElementById('fnMbVolIcon');
  const closeBtn = document.getElementById('fnMbClose');

  function loadTrack(idx, seek) {
    currentTrack = ((idx % TRACKS.length) + TRACKS.length) % TRACKS.length;
    audio.src = TRACKS[currentTrack].src;
    titleEl.textContent = TRACKS[currentTrack].title;
    if (seek) audio.currentTime = seek;
  }

  function syncUI() {
    if (isPlaying) {
      playIcon.className = 'fa-solid fa-pause';
      eqEl.classList.remove('paused');
      mini.classList.add('playing');
    } else {
      playIcon.className = 'fa-solid fa-play';
      eqEl.classList.add('paused');
      mini.classList.remove('playing');
    }
    // icon nút mini
    mini.querySelector('i').className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-music';
    volIcon.className = isMuted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
  }

  function setMinimized(val) {
    isMinimized = val;
    if (val) {
      bar.classList.add('bar-hidden');
      mini.classList.add('mini-visible');
    } else {
      bar.classList.remove('bar-hidden');
      mini.classList.remove('mini-visible');
    }
    persistState();
  }

  function play() {
    audio.play().then(() => {
      isPlaying = true; syncUI(); persistState();
    }).catch(() => {});
  }
  function pause() {
    audio.pause(); isPlaying = false; syncUI(); persistState();
  }

  function persistState() {
    saveState({
      track: currentTrack, time: audio.currentTime,
      playing: isPlaying, muted: isMuted, minimized: isMinimized
    });
  }

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) fillEl.style.width = (audio.currentTime / audio.duration * 100) + '%';
    if (Math.floor(audio.currentTime) % 5 === 0) persistState();
  });
  audio.addEventListener('ended', () => { loadTrack(currentTrack + 1, 0); play(); });

  document.getElementById('fnMbTrack').addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  });

  playBtn.addEventListener('click',  () => { isPlaying ? pause() : play(); });
  nextBtn.addEventListener('click',  () => { loadTrack(currentTrack + 1, 0); if (isPlaying) play(); });
  closeBtn.addEventListener('click', () => setMinimized(true));
  mini.addEventListener('click',     () => {
    setMinimized(false);
    if (!isPlaying) play();
  });
  volBtn.addEventListener('click', () => {
    isMuted = !isMuted; audio.muted = isMuted; syncUI(); persistState();
  });

  // ── KHÔI PHỤC ────────────────────────────────────────────────────────────
  const saved = loadState();
  isMuted = !!saved.muted;
  audio.muted = isMuted;
  loadTrack(saved.track || 0, saved.time || 0);
  if (saved.minimized) setMinimized(true);
  syncUI();

  if (saved.playing && !saved.minimized) {
    document.addEventListener('DOMContentLoaded', () => {
      audio.play().then(() => { isPlaying = true; syncUI(); }).catch(() => {
        const firstClick = () => { audio.currentTime = saved.time || 0; play(); document.removeEventListener('click', firstClick); };
        document.addEventListener('click', firstClick);
      });
    });
  }

  window.addEventListener('beforeunload', persistState);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistState();
  });

})();