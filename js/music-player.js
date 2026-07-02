// =============================================================================
//  FÉE NOIRE — music-player.js  (Phiên bản: Static Files + Shuffle + Xuyên Trang)
//
//  Cách dùng:
//  1. Khai báo danh sách nhạc qua window.FN_TRACKS TRƯỚC khi nhúng file này:
//     <script>
//       window.FN_TRACKS = [
//         { id: 'track_1', title: 'Em Thua Co Ta', src: 'music/Em Thua Co Ta.mp3' },
//         { id: 'track_2', title: 'Alex Morgan',   src: 'music/alex-morgan.mp3'    },
//       ];
//     </script>
//  2. Nhúng file này vào TẤT CẢ trang trước </body>, SAU auth.js
// =============================================================================
(function () {

  // ── TRACKS ──────────────────────────────────────────────────────────────────
  // Nếu không khai báo window.FN_TRACKS, fallback sang scan thư mục music/
  var TRACKS = (Array.isArray(window.FN_TRACKS) && window.FN_TRACKS.length)
    ? window.FN_TRACKS.slice()
    : [];

  // ── State localStorage ──────────────────────────────────────────────────────
  var STATE_KEY = 'fn_music_v4';
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY)) || {}; } catch(e) { return {}; }
  }
  function saveState(patch) {
    var s = Object.assign(loadState(), patch);
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  }

  // ── CSS ─────────────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#fnMusicBar{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:3000;',
    'display:flex;align-items:center;gap:10px;background:rgba(14,11,20,0.92);',
    'border:1px solid rgba(187,134,252,0.3);border-radius:40px;padding:9px 16px 9px 14px;',
    'backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);',
    'box-shadow:0 8px 32px rgba(0,0,0,0.45),0 0 20px rgba(187,134,252,0.08);',
    'transition:opacity 0.35s ease,transform 0.35s ease;width:fit-content;max-width:92vw;}',
    '#fnMusicBar.fn-hidden{opacity:0;pointer-events:none;transform:translateX(-50%) translateY(20px);}',
    '#fnMusicBar.fn-gone{display:none!important;}',
    '#fnMusicMini{position:fixed;right:18px;top:50%;z-index:3000;width:48px;height:48px;',
    'border-radius:50%;border:1px solid rgba(187,134,252,0.5);background:rgba(14,11,20,0.92);',
    'color:#bb86fc;font-size:1.1rem;display:flex;align-items:center;justify-content:center;',
    'cursor:pointer;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);',
    'box-shadow:0 4px 20px rgba(0,0,0,0.4),0 0 14px rgba(187,134,252,0.2);',
    'transition:opacity 0.35s ease,transform 0.35s ease;',
    'opacity:0;pointer-events:none;transform:translateY(-50%) scale(0.6);}',
    '#fnMusicMini.fn-mini-on{opacity:1;pointer-events:all;transform:translateY(-50%) scale(1);}',
    '#fnMusicMini.fn-playing::after{content:"";position:absolute;inset:-5px;border-radius:50%;',
    'border:1px solid rgba(187,134,252,0.4);animation:fnPulse 1.8s ease-in-out infinite;}',
    '@keyframes fnPulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:0;transform:scale(1.35)}}',
    '.fn-play-btn{pointer-events:all;width:36px;height:36px;border-radius:50%;border:1px solid rgba(187,134,252,0.45);',
    'background:rgba(187,134,252,0.12);color:#bb86fc;font-size:.85rem;display:flex;',
    'align-items:center;justify-content:center;cursor:pointer;transition:all .2s;flex-shrink:0;}',
    '.fn-play-btn:hover{background:rgba(187,134,252,0.25);box-shadow:0 0 12px rgba(187,134,252,.3);}',
    '.fn-info{flex:1;overflow:hidden;min-width:0;}',
    '.fn-title{font-size:.78rem;color:rgba(245,246,250,.9);white-space:nowrap;overflow:hidden;',
    'text-overflow:ellipsis;font-family:"Quicksand",sans-serif;}',
    '.fn-prog{pointer-events:all;width:100%;height:3px;background:rgba(255,255,255,.1);border-radius:2px;',
    'margin-top:4px;overflow:hidden;cursor:pointer;}',
    '.fn-prog-fill{height:100%;width:0%;background:linear-gradient(90deg,#bb86fc,#03dac6);',
    'border-radius:2px;transition:width .5s linear;}',
    '.fn-icon{pointer-events:all;width:28px;height:28px;border-radius:50%;border:none;background:transparent;',
    'color:rgba(187,134,252,.6);font-size:.8rem;cursor:pointer;display:flex;align-items:center;',
    'justify-content:center;transition:color .2s;flex-shrink:0;}',
    '.fn-icon:hover{color:#bb86fc;}.fn-icon.fn-on{color:#03dac6;}',
    '.fn-close{pointer-events:all;width:22px;height:22px;border-radius:50%;border:none;',
    'background:rgba(255,71,87,.15);color:rgba(255,71,87,.7);font-size:.65rem;cursor:pointer;',
    'display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;}',
    '.fn-close:hover{background:rgba(255,71,87,.3);color:#ff4757;}',
    '.fn-eq{display:flex;align-items:flex-end;gap:2px;height:16px;flex-shrink:0;}',
    '.fn-eq span{width:3px;background:#bb86fc;border-radius:1px;',
    'animation:fnEq .8s ease-in-out infinite;}',
    '.fn-eq span:nth-child(2){animation-delay:.15s;}.fn-eq span:nth-child(3){animation-delay:.3s;}',
    '.fn-eq.fn-paused span{animation-play-state:paused;height:4px!important;}',
    '@keyframes fnEq{0%,100%{height:4px}50%{height:14px}}'
  ].join('');
  document.head.appendChild(style);

  // ── HTML ─────────────────────────────────────────────────────────────────────
  var bar = document.createElement('div');
  bar.id = 'fnMusicBar';
  bar.innerHTML = [
    '<button class="fn-play-btn" id="fnPlay"><i class="fa-solid fa-play" id="fnPlayIco"></i></button>',
    '<div class="fn-eq fn-paused" id="fnEq"><span></span><span></span><span></span></div>',
    '<div class="fn-info">',
      '<div class="fn-title" id="fnTitle">—</div>',
      '<div class="fn-prog" id="fnProg"><div class="fn-prog-fill" id="fnFill"></div></div>',
    '</div>',
    '<button class="fn-icon" id="fnShuffle" title="Trộn bài"><i class="fa-solid fa-shuffle"></i></button>',
    '<button class="fn-icon" id="fnPrev" title="Bài trước"><i class="fa-solid fa-backward-step"></i></button>',
    '<button class="fn-icon" id="fnNext" title="Bài tiếp"><i class="fa-solid fa-forward-step"></i></button>',
    '<button class="fn-icon" id="fnVol" title="Tắt/Bật tiếng"><i class="fa-solid fa-volume-high" id="fnVolIco"></i></button>',
    '<button class="fn-close" id="fnClose"><i class="fa-solid fa-xmark"></i></button>'
  ].join('');
  document.body.appendChild(bar);

  var mini = document.createElement('button');
  mini.id = 'fnMusicMini'; mini.title = 'Mở nhạc';
  mini.innerHTML = '<i class="fa-solid fa-music"></i>';
  document.body.appendChild(mini);

  // ── REFS ─────────────────────────────────────────────────────────────────────
  var playBtn  = document.getElementById('fnPlay');
  var playIco  = document.getElementById('fnPlayIco');
  var eq       = document.getElementById('fnEq');
  var titleEl  = document.getElementById('fnTitle');
  var fill     = document.getElementById('fnFill');
  var prog     = document.getElementById('fnProg');
  var shufBtn  = document.getElementById('fnShuffle');
  var prevBtn  = document.getElementById('fnPrev');
  var nextBtn  = document.getElementById('fnNext');
  var volBtn   = document.getElementById('fnVol');
  var volIco   = document.getElementById('fnVolIco');
  var closeBtn = document.getElementById('fnClose');

  // ── STATE ─────────────────────────────────────────────────────────────────────
  var shuffleOrder = [];
  var curIdx   = 0;
  var playing  = false;
  var muted    = false;
  var minimized= false;
  var shuffle  = false;
  var audio    = new Audio();
  audio.volume = 0.4;

  // ── SHUFFLE ───────────────────────────────────────────────────────────────────
  function buildShuffle(keepReal) {
    var arr = TRACKS.map(function(_,i){return i;});
    for(var i=arr.length-1;i>0;i--){
      var j=Math.floor(Math.random()*(i+1));
      var t=arr[i];arr[i]=arr[j];arr[j]=t;
    }
    if(keepReal!==undefined){
      var p=arr.indexOf(keepReal);
      if(p>0){var t=arr[0];arr[0]=arr[p];arr[p]=t;}
    }
    return arr;
  }
  function realIdx(){ return shuffle ? shuffleOrder[curIdx] : curIdx; }

  // ── UI ────────────────────────────────────────────────────────────────────────
  function syncUI() {
    playIco.className = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    playing ? eq.classList.remove('fn-paused') : eq.classList.add('fn-paused');
    mini.classList.toggle('fn-playing', playing);
    mini.querySelector('i').className = playing ? 'fa-solid fa-pause' : 'fa-solid fa-music';
    volIco.className = muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
    shufBtn.classList.toggle('fn-on', shuffle);
  }
  function setMin(val) {
    minimized = val;
    bar.classList.toggle('fn-hidden', val);
    mini.classList.toggle('fn-mini-on', val);
    saveState({minimized: val});
  }

  // ── AUDIO ─────────────────────────────────────────────────────────────────────
  function loadTrack(pos, seekTo) {
    if(!TRACKS.length) return;
    var total = shuffle ? shuffleOrder.length : TRACKS.length;
    curIdx = ((pos % total) + total) % total;
    var t = TRACKS[realIdx()];
    if(!t) return;
    audio.src = t.src;
    titleEl.textContent = t.title;
    fill.style.width = '0%';
    if(seekTo > 0) {
      audio.addEventListener('loadedmetadata', function onM(){
        audio.currentTime = seekTo;
        audio.removeEventListener('loadedmetadata', onM);
      });
    }
    saveState({trackId: t.id, time: 0});
  }
  function doPlay() {
    if(!TRACKS.length) return;
    audio.play().then(function(){ playing=true; syncUI(); saveState({playing:true}); }).catch(function(){});
  }
  function doPause() { audio.pause(); playing=false; syncUI(); saveState({playing:false}); }
  function skipTo(pos) { loadTrack(pos); if(playing) doPlay(); }
  function nextTrack() {
    var total = shuffle ? shuffleOrder.length : TRACKS.length;
    if(curIdx+1 >= total && shuffle) { shuffleOrder=buildShuffle(); saveState({shuffleOrder:shuffleOrder}); skipTo(0); }
    else skipTo(curIdx+1);
  }

  // ── EVENTS ────────────────────────────────────────────────────────────────────
  audio.addEventListener('timeupdate', function(){
    if(audio.duration) fill.style.width=(audio.currentTime/audio.duration*100)+'%';
    var now=Math.floor(audio.currentTime);
    if(now!==(loadState()._sec||-1)) saveState({time:audio.currentTime,_sec:now});
  });
  audio.addEventListener('ended', nextTrack);
  window.addEventListener('beforeunload', function(){
    saveState({time:audio.currentTime,playing:playing,muted:muted});
  });
  prog.addEventListener('click', function(e){
    if(!audio.duration) return;
    var r=prog.getBoundingClientRect();
    audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration;
  });
  playBtn.addEventListener('click',  function(){ playing ? doPause() : doPlay(); });
  prevBtn.addEventListener('click',  function(){ skipTo(curIdx-1); });
  nextBtn.addEventListener('click',  nextTrack);
  volBtn.addEventListener('click',   function(){ muted=!muted; audio.muted=muted; syncUI(); saveState({muted:muted}); });
  closeBtn.addEventListener('click', function(){ setMin(true); });
  mini.addEventListener('click',     function(){ setMin(false); if(!playing) doPlay(); });
  shufBtn.addEventListener('click',  function(){
    shuffle=!shuffle;
    if(shuffle){ shuffleOrder=buildShuffle(realIdx()); curIdx=0; saveState({shuffle:true,shuffleOrder:shuffleOrder}); }
    else { curIdx=realIdx(); saveState({shuffle:false,shuffleOrder:null}); }
    syncUI();
  });

  // ── INIT ──────────────────────────────────────────────────────────────────────
  function init() {
    if(!TRACKS.length) {
      // Không có track → ẩn hoàn toàn
      bar.classList.add('fn-gone');
      return;
    }

    var st = loadState();
    muted    = !!st.muted;
    shuffle  = !!st.shuffle;
    minimized= !!st.minimized;
    audio.muted = muted;

    if(shuffle && Array.isArray(st.shuffleOrder) && st.shuffleOrder.length===TRACKS.length) {
      shuffleOrder = st.shuffleOrder;
    } else if(shuffle) {
      shuffleOrder = buildShuffle();
    }

    var startPos = 0;
    if(st.trackId) {
      var ri = TRACKS.findIndex(function(t){ return t.id===st.trackId; });
      if(ri!==-1) startPos = shuffle ? (shuffleOrder.indexOf(ri)||0) : ri;
    }

    loadTrack(startPos, st.time||0);
    if(minimized) setMin(true);
    syncUI();

    if(st.playing) {
      audio.play()
        .then(function(){ playing=true; syncUI(); })
        .catch(function(){
          function resume(){
            audio.play().then(function(){ playing=true; syncUI(); saveState({playing:true}); }).catch(function(){});
            document.removeEventListener('click',   resume);
            document.removeEventListener('keydown', resume);
          }
          document.addEventListener('click',   resume, {once:true});
          document.addEventListener('keydown', resume, {once:true});
        });
    }
  }

  init();
})();