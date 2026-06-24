// =============================================================================
//  FÉE NOIRE — music-player.js  (Phiên bản: Xuyên Trang + Shuffle + Phân Quyền)
//  Nhúng vào TẤT CẢ trang (trước </body>), SAU auth.js.
//
//  Cơ chế giữ nhạc xuyên trang (multi-page):
//  - Blob lưu IndexedDB (bền vững), mỗi trang tạo lại ObjectURL từ blob
//  - Trước khi chuyển trang: lưu { trackId, time, playing, shuffleOrder } vào localStorage
//  - Trang mới load: restore trackId → tìm trong IndexedDB → seek → autoplay
//  - Autoplay cross-page: trình duyệt cho phép nếu user đã tương tác ≥1 lần trong session
//
//  Shuffle:
//  - Lưu mảng index đã xáo trộn vào state, duyệt theo mảng đó
//  - Reshuffle khi bật shuffle hoặc khi hết danh sách
// =============================================================================
(function () {

  // ── CẤU HÌNH ────────────────────────────────────────────────────────────────
  const GAS_URL           = typeof window.FN_GAS_URL           !== 'undefined' ? window.FN_GAS_URL           : '';
  const CDN_CLOUD_NAME    = typeof window.FN_CDN_CLOUD_NAME    !== 'undefined' ? window.FN_CDN_CLOUD_NAME    : 'drachynaq';
  const CDN_UPLOAD_PRESET = typeof window.FN_CDN_UPLOAD_PRESET !== 'undefined' ? window.FN_CDN_UPLOAD_PRESET : 'n3he1tcy';

  // ── IndexedDB ───────────────────────────────────────────────────────────────
  const DB_NAME    = 'fn_music_db';
  const DB_VER     = 1;
  const STORE      = 'tracks';
  const STATE_KEY  = 'fn_music_v3';   // key mới tránh xung đột state cũ

  function openDB() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE))
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = e => res(e.target.result);
      req.onerror   = e => rej(e.target.error);
    });
  }
  function dbGetAll(db) {
    return new Promise((res, rej) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = e => res(e.target.result || []);
      req.onerror   = e => rej(e.target.error);
    });
  }
  function dbPut(db, rec) {
    return new Promise((res, rej) => {
      const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(rec);
      req.onsuccess = e => res(e.target.result);
      req.onerror   = e => rej(e.target.error);
    });
  }
  function dbDelete(db, id) {
    return new Promise((res, rej) => {
      const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
      req.onsuccess = () => res();
      req.onerror   = e => rej(e.target.error);
    });
  }

  // ── State localStorage ──────────────────────────────────────────────────────
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
    #fnMusicBar.bar-empty { min-width: unset; padding: 8px 14px; gap: 8px; }

    #fnMusicMini {
      position: fixed; right: 18px; top: 50%;
      transform: translateY(-50%) scale(0.6);
      z-index: 3000; width: 48px; height: 48px; border-radius: 50%;
      border: 1px solid rgba(187,134,252,0.5);
      background: rgba(14,11,20,0.92); color: #bb86fc; font-size: 1.1rem;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 14px rgba(187,134,252,0.2);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      transition: opacity 0.35s ease, transform 0.35s ease, box-shadow 0.25s ease;
      opacity: 0; pointer-events: none; position: fixed;
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
    /* Shuffle bật sáng */
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

    /* Nút admin nhỏ */
    .fn-mb-admin-btn {
      width:26px;height:26px;border-radius:50%;border:none;
      background:transparent;color:rgba(187,134,252,.4);font-size:.7rem;
      cursor:pointer;display:flex;align-items:center;justify-content:center;
      transition:all .2s;flex-shrink:0;
    }
    .fn-mb-admin-btn:hover{color:#bb86fc;background:rgba(187,134,252,.12);}
    .fn-mb-admin-btn.danger{color:rgba(255,71,87,.4);}
    .fn-mb-admin-btn.danger:hover{color:#ff4757;background:rgba(255,71,87,.12);}

    /* Nút upload rỗng */
    #fnMbUploadBtn {
      font-size:.75rem;color:rgba(187,134,252,.85);
      background:rgba(187,134,252,.1);
      border:1px dashed rgba(187,134,252,.4);border-radius:20px;
      padding:5px 12px;cursor:pointer;white-space:nowrap;
      transition:all .2s;display:flex;align-items:center;gap:6px;flex-shrink:0;
    }
    #fnMbUploadBtn:hover{background:rgba(187,134,252,.2);border-color:rgba(187,134,252,.7);}
  `;
  document.head.appendChild(style);

  // ── HTML BAR ────────────────────────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.id = 'fnMusicBar';
  bar.innerHTML = `
    <!-- Trạng thái có nhạc -->
    <div id="fnPlayerFull" style="display:none;align-items:center;gap:10px;width:100%;">
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
      <!-- Nút chỉ Admin thấy -->
      <button class="fn-mb-admin-btn danger" id="fnMbDel" title="Xóa bài này" style="position:relative;">
        <i class="fa-solid fa-trash-can"></i>
      </button>
      <label class="fn-mb-admin-btn" id="fnMbAddMore" title="Thêm nhạc" style="cursor:pointer;">
        <i class="fa-solid fa-plus"></i>
        <input type="file" id="fnMbMoreInput" accept="audio/mp3,audio/mpeg,audio/*" multiple style="display:none;">
      </label>
      <button class="fn-mb-close" id="fnMbClose" title="Thu gọn"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <!-- Trạng thái chưa có nhạc -->
    <div id="fnPlayerEmpty" style="display:flex;align-items:center;gap:8px;">
      <i class="fa-solid fa-music" style="color:rgba(187,134,252,.5);font-size:.85rem;"></i>
      <span style="font-size:.75rem;color:rgba(245,246,250,.5);font-family:'Quicksand',sans-serif;"
            id="fnEmptyLabel">Nhạc nền chưa được thêm</span>
      <label id="fnMbUploadBtn">
        <i class="fa-solid fa-upload"></i> Chọn MP3
        <input type="file" id="fnMbUploadInput" accept="audio/mp3,audio/mpeg,audio/*" multiple style="display:none;">
      </label>
      <button class="fn-mb-close" id="fnMbCloseEmpty"><i class="fa-solid fa-xmark"></i></button>
    </div>
  `;
  document.body.appendChild(bar);

  const mini = document.createElement('button');
  mini.id = 'fnMusicMini';
  mini.title = 'Mở nhạc';
  mini.innerHTML = '<i class="fa-solid fa-music"></i>';
  document.body.appendChild(mini);

  // ── REFS ────────────────────────────────────────────────────────────────────
  const playerFull    = document.getElementById('fnPlayerFull');
  const playerEmpty   = document.getElementById('fnPlayerEmpty');
  const playBtn       = document.getElementById('fnMbPlay');
  const playIcon      = document.getElementById('fnMbPlayIcon');
  const eqEl          = document.getElementById('fnMbEq');
  const titleEl       = document.getElementById('fnMbTitle');
  const fillEl        = document.getElementById('fnMbFill');
  const trackBar      = document.getElementById('fnMbTrack');
  const prevBtn       = document.getElementById('fnMbPrev');
  const nextBtn       = document.getElementById('fnMbNext');
  const shuffleBtn    = document.getElementById('fnMbShuffle');
  const volBtn        = document.getElementById('fnMbVol');
  const volIcon       = document.getElementById('fnMbVolIcon');
  const delBtn        = document.getElementById('fnMbDel');
  const addMoreLabel  = document.getElementById('fnMbAddMore');
  const moreInput     = document.getElementById('fnMbMoreInput');
  const closeBtn      = document.getElementById('fnMbClose');
  const closeEmptyBtn = document.getElementById('fnMbCloseEmpty');
  const uploadInput   = document.getElementById('fnMbUploadInput');

  // ── RUNTIME STATE ───────────────────────────────────────────────────────────
  let db          = null;
  let TRACKS      = [];   // [{ id, title, blob }]  — thứ tự gốc từ IndexedDB
  let shuffleOrder = [];  // mảng index đã xáo trộn
  let currentIdx  = 0;   // vị trí trong shuffleOrder (nếu shuffle) hoặc TRACKS
  let isPlaying   = false;
  let isMuted     = false;
  let isMinimized = false;
  let isShuffle   = false;
  let currentBlob = null;

  const audio = new Audio();
  audio.volume = 0.4;

  // ── SHUFFLE HELPERS ─────────────────────────────────────────────────────────
  function buildShuffleOrder(keepId) {
    // Tạo mảng index [0..n-1] xáo ngẫu nhiên
    // Nếu có keepId: đặt bài đang phát vào đầu để không bị gián đoạn
    const arr = TRACKS.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (keepId !== undefined) {
      const pos = arr.indexOf(TRACKS.findIndex(t => t.id === keepId));
      if (pos > 0) { const tmp = arr[0]; arr[0] = arr[pos]; arr[pos] = tmp; }
    }
    return arr;
  }

  function resolveTrackIndex(posInOrder) {
    // Trả về index thực trong TRACKS từ vị trí trong playlist hiện tại
    if (isShuffle) return shuffleOrder[posInOrder];
    return posInOrder;
  }

  function currentTrackRealIdx() { return resolveTrackIndex(currentIdx); }

  // ── UI HELPERS ──────────────────────────────────────────────────────────────
  function showPlayerMode(hasTrack) {
    if (hasTrack) {
      playerFull.style.display  = 'flex';
      playerEmpty.style.display = 'none';
      bar.classList.remove('bar-empty');
    } else {
      playerFull.style.display  = 'none';
      playerEmpty.style.display = 'flex';
      bar.classList.add('bar-empty');
    }
  }

  function syncUI() {
    playIcon.className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    isPlaying ? eqEl.classList.remove('paused') : eqEl.classList.add('paused');
    mini.classList.toggle('playing', isPlaying);
    mini.querySelector('i').className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-music';
    volIcon.className = isMuted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
    shuffleBtn.classList.toggle('active', isShuffle);
  }

  function applyRoleUI() {
    const admin = isAdmin();
    const uploadBtn = document.getElementById('fnMbUploadBtn');
    const emptyLabel = document.getElementById('fnEmptyLabel');
    if (uploadBtn)  uploadBtn.style.display  = admin ? '' : 'none';
    if (emptyLabel) emptyLabel.textContent   = admin ? 'Chưa có nhạc — upload MP3' : 'Nhạc nền chưa được thêm';
    if (delBtn)      delBtn.style.display      = admin ? '' : 'none';
    if (addMoreLabel) addMoreLabel.style.display = admin ? '' : 'none';
  }

  function setMinimized(val) {
    isMinimized = val;
    bar.classList.toggle('bar-hidden', val);
    mini.classList.toggle('mini-visible', val);
    saveState({ minimized: val });
  }

  // ── AUDIO CORE ──────────────────────────────────────────────────────────────
  function loadTrack(posInOrder, seekTo) {
    if (!TRACKS.length) return;
    const total = isShuffle ? shuffleOrder.length : TRACKS.length;
    currentIdx = ((posInOrder % total) + total) % total;
    const realIdx = currentTrackRealIdx();
    const t = TRACKS[realIdx];
    if (!t) return;
    if (currentBlob) { URL.revokeObjectURL(currentBlob); currentBlob = null; }
    // Ưu tiên blob (local upload), fallback sang src URL (GAS)
    if (t.blob) {
      currentBlob = URL.createObjectURL(t.blob);
      audio.src = currentBlob;
    } else {
      audio.src = t.src;
    }
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

  function skipTo(posInOrder) {
    loadTrack(posInOrder);
    if (isPlaying) play();
  }

  function nextTrack() {
    const total = isShuffle ? shuffleOrder.length : TRACKS.length;
    const next  = currentIdx + 1;
    if (next >= total && isShuffle) {
      // Hết playlist shuffle → xáo lại
      shuffleOrder = buildShuffleOrder();
      saveState({ shuffleOrder });
      skipTo(0);
    } else {
      skipTo(next);
    }
  }

  // ── PERSIST TIME liên tục ───────────────────────────────────────────────────
  // Lưu currentTime mỗi giây để trang kế restore đúng vị trí
  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      fillEl.style.width = (audio.currentTime / audio.duration * 100) + '%';
    }
    // Ghi mỗi giây (tránh write quá nhiều)
    const now = Math.floor(audio.currentTime);
    if (now !== (loadState()._lastSavedSec || -1)) {
      saveState({ time: audio.currentTime, _lastSavedSec: now });
    }
  });
  audio.addEventListener('ended', nextTrack);

  // Lưu ngay trước khi rời trang (beforeunload)
  window.addEventListener('beforeunload', () => {
    saveState({ time: audio.currentTime, playing: isPlaying, muted: isMuted });
  });

  // ── CONTROLS ────────────────────────────────────────────────────────────────
  trackBar.addEventListener('click', e => {
    if (!audio.duration) return;
    const rect = trackBar.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  });

  playBtn.addEventListener('click', () => { isPlaying ? pause() : play(); });

  prevBtn.addEventListener('click', () => { skipTo(currentIdx - 1); });

  nextBtn.addEventListener('click', nextTrack);

  shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    if (isShuffle) {
      // Bật shuffle: xáo trộn, đặt bài đang phát vào đầu
      const currentId = TRACKS[currentTrackRealIdx()]?.id;
      shuffleOrder = buildShuffleOrder(currentId);
      // Tìm lại vị trí bài hiện tại trong shuffleOrder mới
      const pos = shuffleOrder.indexOf(currentTrackRealIdx());
      currentIdx = pos !== -1 ? pos : 0;
      saveState({ shuffle: true, shuffleOrder });
    } else {
      // Tắt shuffle: currentIdx quay về index thực trong TRACKS
      currentIdx = currentTrackRealIdx();
      saveState({ shuffle: false, shuffleOrder: null });
    }
    syncUI();
  });

  volBtn.addEventListener('click', () => {
    isMuted = !isMuted; audio.muted = isMuted; syncUI(); saveState({ muted: isMuted });
  });

  closeBtn.addEventListener('click',      () => setMinimized(true));
  closeEmptyBtn.addEventListener('click', () => setMinimized(true));
  mini.addEventListener('click', () => {
    setMinimized(false);
    if (!isPlaying && TRACKS.length) play();
  });

  // ── UPLOAD FILES → CLOUDINARY → GAS ────────────────────────────────────────
  async function uploadToCloudinary(file) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CDN_UPLOAD_PRESET);
    fd.append('resource_type', 'video'); // Cloudinary dùng 'video' cho audio
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${CDN_CLOUD_NAME}/video/upload`, { method: 'POST', body: fd });
    const json = await res.json();
    if (!json.secure_url) throw new Error(json.error?.message || 'Upload Cloudinary thất bại');
    return json.secure_url;
  }

  async function saveToGAS(title, src) {
    if (!GAS_URL) return;
    const session = JSON.parse(sessionStorage.getItem('fee_noire_session') || '{}');
    const res  = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addMusic', token: session.token, title, src })
    });
    const json = await res.json();
    if (json.status !== 'ok') throw new Error(json.message || 'Lưu GAS thất bại');
  }

  function showUploadStatus(msg, isError) {
    let el = document.getElementById('fnUploadStatus');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fnUploadStatus';
      el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
        'background:rgba(14,11,20,0.95);border:1px solid rgba(187,134,252,0.4);border-radius:20px;' +
        'padding:7px 16px;font-size:.75rem;font-family:Quicksand,sans-serif;z-index:4000;' +
        'color:#e0e0e0;pointer-events:none;transition:opacity .3s;';
      document.body.appendChild(el);
    }
    el.style.color = isError ? '#ff4757' : '#bb86fc';
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 3000);
  }

  async function handleFiles(files) {
    if (!files || !files.length) return;
    const arr = Array.from(files).filter(f => f.type.startsWith('audio/'));
    if (!arr.length) return;

    const wasEmpty = TRACKS.length === 0;
    let addedAny = false;

    for (const file of arr) {
      const title = file.name.replace(/\.[^.]+$/, '');
      showUploadStatus(`Đang upload "${title}"…`);
      try {
        const src = await uploadToCloudinary(file);
        await saveToGAS(title, src);
        showUploadStatus(`✓ Đã thêm "${title}"`);

        // Thêm thẳng vào TRACKS luôn, không chờ GAS fetch lại
        const tempId = 'gas_music_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        TRACKS.push({ id: tempId, title, src, _src: 'gas' });
        addedAny = true;
      } catch (ex) {
        showUploadStatus(`✗ ${ex.message}`, true);
      }
    }

    if (!addedAny) return;

    if (isShuffle) shuffleOrder = buildShuffleOrder();
    showPlayerMode(true);

    if (wasEmpty) {
      // Phát bài đầu tiên vừa thêm
      const startPos = isShuffle ? 0 : TRACKS.length - (arr.filter(f => f.type.startsWith('audio/')).length);
      loadTrack(Math.max(0, startPos));
      play();
    }
    // Sau 2s re-fetch GAS để sync id thật (tránh id tạm)
    setTimeout(() => window.dispatchEvent(new Event('fn:musicLibraryChanged')), 2000);
  }

  uploadInput.addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });
  moreInput.addEventListener('change',   e => { handleFiles(e.target.files); e.target.value = ''; });

  // ── XÓA BÀI ────────────────────────────────────────────────────────────────
  delBtn.addEventListener('click', async () => {
    if (!TRACKS.length) return;
    const realIdx   = currentTrackRealIdx();
    const track     = TRACKS[realIdx];
    pause();

    try {
      if (track._src === 'gas' && GAS_URL) {
        // Xóa bài GAS: id có dạng 'gas_music_xxx', bỏ prefix 'gas_'
        const gasId  = track.id.replace(/^gas_/, '');
        const session = JSON.parse(sessionStorage.getItem('fee_noire_session') || '{}');
        const res  = await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'deleteMusic', token: session.token, id: gasId })
        });
        const json = await res.json();
        if (json.status !== 'ok') throw new Error(json.message);
        showUploadStatus(`✓ Đã xóa "${track.title}"`);
        window.dispatchEvent(new Event('fn:musicLibraryChanged'));
      } else {
        // Xóa bài local (IndexedDB)
        await dbDelete(db, track.id);
        TRACKS.splice(realIdx, 1);
        if (currentBlob) { URL.revokeObjectURL(currentBlob); currentBlob = null; }
        if (!TRACKS.length) { audio.src = ''; showPlayerMode(false); return; }
        if (isShuffle) { shuffleOrder = buildShuffleOrder(); currentIdx = 0; }
        else { if (currentIdx >= TRACKS.length) currentIdx = 0; }
        loadTrack(currentIdx);
        play();
      }
    } catch (ex) {
      showUploadStatus(`✗ ${ex.message}`, true);
    }
  });

  // ── ĐỒNG BỘ VỚI TAB ADMIN ──────────────────────────────────────────────────
  window.addEventListener('fn:musicLibraryChanged', async () => {
    if (!db) return;
    const wasPlaying = isPlaying;
    const savedId    = TRACKS[currentTrackRealIdx()]?.id;
    pause();

    // Re-load local
    const rows2 = await dbGetAll(db);
    const local2 = rows2.map(r => ({ id: r.id, title: r.title, blob: r.blob, _src: 'local' }));

    // Re-fetch GAS
    let gas2 = [];
    if (typeof GAS_URL !== 'undefined' && GAS_URL) {
      try {
        const res  = await fetch(GAS_URL + '?action=getMusic');
        const json = await res.json();
        if (json.status === 'ok' && Array.isArray(json.music)) {
          gas2 = json.music.filter(m => m.src)
            .map(m => ({ id: 'gas_' + m.id, title: m.title, src: m.src, _src: 'gas' }));
        }
      } catch (_) {}
    }
    const gasIds2 = new Set(gas2.map(t => t.id));
    TRACKS = [...gas2, ...local2.filter(t => !gasIds2.has(t.id))];
    if (!TRACKS.length) {
      if (currentBlob) { URL.revokeObjectURL(currentBlob); currentBlob = null; }
      audio.src = ''; showPlayerMode(false); return;
    }
    if (isShuffle) shuffleOrder = buildShuffleOrder();
    showPlayerMode(true);
    const keepIdx = TRACKS.findIndex(t => t.id === savedId);
    const newPos  = isShuffle ? shuffleOrder.indexOf(keepIdx !== -1 ? keepIdx : 0) : (keepIdx !== -1 ? keepIdx : 0);
    loadTrack(newPos !== -1 ? newPos : 0);
    if (wasPlaying) play();
  });

  // ── AUTH CHANGED ────────────────────────────────────────────────────────────
  window.addEventListener('fn:authChanged', applyRoleUI);

  // ── INIT ────────────────────────────────────────────────────────────────────
  async function initPlayer() {
    try { db = await openDB(); }
    catch { db = null; applyRoleUI(); showPlayerMode(false); return; }

    // ── Load nhạc local (IndexedDB) — chỉ admin upload được ──
    const rows  = await dbGetAll(db);
    const localTracks = rows.map(r => ({ id: r.id, title: r.title, blob: r.blob, _src: 'local' }));

    // ── Load nhạc từ GAS (tất cả user đều thấy) ──
    let gasTracks = [];
    if (typeof GAS_URL !== 'undefined' && GAS_URL) {
      try {
        const res  = await fetch(GAS_URL + '?action=getMusic');
        const json = await res.json();
        if (json.status === 'ok' && Array.isArray(json.music)) {
          gasTracks = json.music
            .filter(m => m.src)
            .map(m => ({ id: 'gas_' + m.id, title: m.title, src: m.src, _src: 'gas' }));
        }
      } catch (_) { /* GAS lỗi → chỉ dùng local */ }
    }

    // Merge: GAS trước (thứ tự admin đặt), local sau (bài admin upload thêm tạm)
    // Tránh trùng nếu có bài nào cùng id
    const gasIds = new Set(gasTracks.map(t => t.id));
    TRACKS = [...gasTracks, ...localTracks.filter(t => !gasIds.has(t.id))];

    const st    = loadState();
    isMuted     = !!st.muted;
    isShuffle   = !!st.shuffle;
    isMinimized = !!st.minimized;
    audio.muted = isMuted;

    applyRoleUI();

    if (!TRACKS.length) {
      showPlayerMode(false);
      if (isMinimized) setMinimized(true);
      return;
    }

    showPlayerMode(true);

    // Restore shuffle order
    if (isShuffle && Array.isArray(st.shuffleOrder) && st.shuffleOrder.length === TRACKS.length) {
      shuffleOrder = st.shuffleOrder;
    } else if (isShuffle) {
      shuffleOrder = buildShuffleOrder();
    }

    // Tìm bài đã phát lần trước
    let startPos = 0;
    if (st.trackId) {
      const realIdx = TRACKS.findIndex(t => t.id === st.trackId);
      if (realIdx !== -1) {
        startPos = isShuffle ? (shuffleOrder.indexOf(realIdx) || 0) : realIdx;
      }
    }

    const savedTime = st.time || 0;
    loadTrack(startPos, savedTime);
    if (isMinimized) setMinimized(true);
    syncUI();

    // ── Autoplay cross-page ────────────────────────────────────────────────
    // Trình duyệt cho phép autoplay nếu user đã tương tác với trang gốc
    // (click chuyển trang = đã tương tác). Thử play ngay; nếu bị chặn thì
    // đặt handler click-một-lần để play khi user chạm trang này lần đầu.
    if (st.playing) {
      audio.play()
        .then(() => { isPlaying = true; syncUI(); })
        .catch(() => {
          // Autoplay bị chặn → chờ tương tác đầu tiên
          const resume = () => {
            audio.play().then(() => { isPlaying = true; syncUI(); saveState({ playing: true }); }).catch(() => {});
            document.removeEventListener('click', resume);
            document.removeEventListener('keydown', resume);
          };
          document.addEventListener('click',   resume, { once: true });
          document.addEventListener('keydown', resume, { once: true });
        });
    }
  }

  initPlayer();

})();
