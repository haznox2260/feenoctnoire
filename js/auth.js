// =============================================================================
//  FÉE NOIRE — auth.js (BẢN CHUẨN HÓA KẾT NỐI VÀ ĐỒNG BỘ GOOGLE SHEETS)
//  Nhúng vào TẤT CẢ trang. Tự động:
//   - Inject offcanvas đăng nhập hệ thống kết nối trực tiếp Google Sheets
//   - Hiển thị/ẩn link "Quản Lý" trên nav dựa trên session đồng bộ
//   - Xử lý login / logout tập trung qua GAS_URL dạng POST text/plain
// =============================================================================

(function () {
  const offcanvasHTML = `
  <div class="offcanvas offcanvas-end custom-offcanvas" tabindex="-1" id="authOffcanvas">
    <div class="offcanvas-header border-bottom border-secondary border-opacity-25">
      <h5 class="offcanvas-title text-white">
        <i class="fa-solid fa-lock text-warning me-2"></i>Hệ Thống Nội Bộ
      </h5>
      <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
    </div>
    <div class="offcanvas-body d-flex flex-column justify-content-between">
      <div id="offcanvasLoginForm">
        <p class="text-white-50 small mb-4">Vui lòng nhập tài khoản nội bộ Fée Noire dữ liệu từ Google Sheets để làm việc.</p>
        <div id="loginAlert" class="alert custom-alert d-none py-2 small mb-3"></div>
        <form onsubmit="FeeNoireAuth.handleLogin(event)">
          <div class="mb-3">
            <label class="form-label text-white-50 small">Tài khoản</label>
            <input type="text" class="form-control custom-input" id="authUsername" required placeholder="admin / luix / yuki">
          </div>
          <div class="mb-4">
            <label class="form-label text-white-50 small">Mật khẩu</label>
            <input type="password" class="form-control custom-input" id="authPassword" required placeholder="••••••••">
          </div>
          <button type="submit" class="btn btn-warning w-100 btn-login-submit fw-bold py-2">
            Đăng Nhập Hệ Thống
          </button>
        </form>
      </div>
      <div id="offcanvasUserForm" class="d-none text-center py-4">
        <div class="avatar-placeholder mb-3 mx-auto">✨</div>
        <h4 class="text-white mb-1" id="lblUserName">Chủ Nhiệm Tiên</h4>
        <p class="text-warning small mb-4" id="lblUserRole">Quản trị viên (admin)</p>
        <div class="d-flex flex-column gap-2 px-3">
          <a href="admin.html" class="btn btn-outline-light w-100 py-2 btn-dashboard-link">
            <i class="fa-solid fa-chart-line me-2"></i>Bàn Làm Việc
          </a>
          <button onclick="FeeNoireAuth.logout()" class="btn btn-danger w-100 py-2 fw-bold">
            <i class="fa-solid fa-power-off me-2"></i>Đăng Xuất
          </button>
        </div>
      </div>
      <div class="text-center border-top border-secondary border-opacity-25 pt-3 text-white-50 small" style="font-size: 0.75rem;">
        &copy; 2026 Fée Noire • Hệ thống đồng bộ dữ liệu
      </div>
    </div>
  </div>
  `;
  document.body.insertAdjacentHTML('beforeend', offcanvasHTML);

  const toastCSS = `
  <style id="feeNoireToastStyle">
    #fnToastStack {
      position: fixed; top: 90px; right: 20px; z-index: 2000;
      display: flex; flex-direction: column; gap: 10px; max-width: 340px;
    }
    .fn-toast {
      background: rgba(14, 11, 20, 0.92);
      border: 1px solid rgba(187, 134, 252, 0.3);
      border-left: 4px solid var(--accent-glow, #bb86fc);
      color: #f5f6fa; border-radius: 12px; padding: 13px 16px;
      font-family: 'Quicksand', sans-serif; font-size: 0.9rem;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
      display: flex; align-items: flex-start; gap: 10px;
      animation: fnToastIn 0.25s ease forwards; opacity: 0; transform: translateX(20px);
    }
    .fn-toast.success { border-left-color: #03dac6; }
    .fn-toast.error { border-left-color: #ff4757; }
    .fn-toast i { margin-top: 2px; }
    .fn-toast.success i { color: #03dac6; }
    .fn-toast.error i { color: #ff4757; }
    .fn-toast.info i { color: var(--accent-glow, #bb86fc); }
    .fn-toast.fade-out { animation: fnToastOut 0.25s ease forwards; }
    @keyframes fnToastIn { to { opacity: 1; transform: translateX(0); } }
    @keyframes fnToastOut { to { opacity: 0; transform: translateX(20px); } }
    #authOffcanvas { z-index: 1200 !important; }
    .offcanvas-backdrop { z-index: 1190 !important; }
  </style>
  <div id="fnToastStack"></div>
  `;
  document.body.insertAdjacentHTML('beforeend', toastCSS);

  function showToast(message, type) {
    const stack = document.getElementById('fnToastStack');
    if (!stack) return;
    type = type || 'info';
    const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info');
    const toastEl = document.createElement('div');
    toastEl.className = 'fn-toast ' + type;
    toastEl.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    stack.appendChild(toastEl);
    setTimeout(() => {
      toastEl.classList.add('fade-out');
      setTimeout(() => toastEl.remove(), 250);
    }, 3500);
  }

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem('fee_noire_session')); } catch (_) { return null; }
  }

  function getOffcanvasInstance() {
    const el = document.getElementById('authOffcanvas');
    if (!el || !window.bootstrap) return null;
    return bootstrap.Offcanvas.getInstance(el) || new bootstrap.Offcanvas(el);
  }

  function fnOpenDrawer() {
    document.getElementById('fnMobileDrawer')?.classList.add('open');
    document.getElementById('fnMobileOverlay')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function fnCloseDrawer() {
    document.getElementById('fnMobileDrawer')?.classList.remove('open');
    document.getElementById('fnMobileOverlay')?.classList.remove('open');
    document.body.style.overflow = '';
  }
  function fnToggleSub(el) {
    const sub = el.nextElementSibling;
    const chev = el.querySelector('.fn-chevron');
    if (sub) sub.classList.toggle('open');
    if (chev) chev.classList.toggle('rotated');
  }

  const FN_DRAWER_LINKS = [
    { href: 'index.html', icon: 'fa-house', label: 'Trang Chủ' },
    { type: 'group', icon: 'fa-book-open', label: 'Câu Chuyện', children: [
        { href: 'cauchuyen.html', icon: 'fa-book-open', label: 'Câu Chuyện' },
        { href: 'trananh.html', icon: 'fa-images', label: 'Tranh Ảnh' }
      ] },
    { href: 'nhanvien.html', icon: 'fa-star', label: 'Staff' },
    { href: 'banggia.html', icon: 'fa-tags', label: 'Bảng Giá' },
    { href: 'https://haznox2260.github.io/FN_fo/', icon: 'fa-pen-nib', label: 'Đặt Đơn' }
  ];

  function fnIsActiveHref(href) {
    const cur = window.location.pathname;
    if (href === 'index.html') return cur.endsWith('index.html') || cur === '/' || cur.endsWith('/');
    const slug = href.replace('.html', '');
    return cur.includes(slug);
  }

  function buildDrawerNav() {
    const nav = document.getElementById('fnDrawerNav');
    if (!nav) return;
    let html = '';
    FN_DRAWER_LINKS.forEach((l) => {
      if (l.type === 'group') {
        const groupActive = l.children.some((c) => fnIsActiveHref(c.href));
        html += '<div>';
        html += '<div class="fn-drawer-item' + (groupActive ? ' active' : '') + '" onclick="FeeNoireAuth.toggleDrawerSub(this)">';
        html += '<i class="fa-solid ' + l.icon + '"></i>' + l.label;
        html += '<i class="fa-solid fa-chevron-down fn-chevron ms-auto" style="font-size:0.7rem;' + (groupActive ? 'transform:rotate(180deg);' : '') + '"></i>';
        html += '</div>';
        html += '<div class="fn-drawer-sub' + (groupActive ? ' open' : '') + '">';
        l.children.forEach((c) => {
          html += '<a href="' + c.href + '"' + (fnIsActiveHref(c.href) ? ' class="active"' : '') + '><i class="fa-solid ' + c.icon + '"></i>' + c.label + '</a>';
        });
        html += '</div></div>';
      } else {
        html += '<a href="' + l.href + '"' + (fnIsActiveHref(l.href) ? ' class="active"' : '') + '><i class="fa-solid ' + l.icon + '"></i>' + l.label + '</a>';
      }
    });
    html += '<div class="fn-drawer-divider"></div>';
    html += '<a href="admin.html" id="fnDrawerAdminLink" style="display:none;color:#bb86fc;"><i class="fa-solid fa-shield-halved"></i>Quản Lý</a>';
    nav.innerHTML = html;
  }

  function ensureHamburger() {
    const navbar = document.querySelector('header.navbar');
    if (!navbar || navbar.querySelector('.fn-hamburger')) return;
    const btn = document.createElement('button');
    btn.className = 'fn-hamburger';
    btn.setAttribute('aria-label', 'Mo menu');
    btn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    btn.onclick = fnOpenDrawer;
    navbar.appendChild(btn);
  }

  function syncDrawerAuth(user) {
    const txt = document.getElementById('fnDrawerUserText');
    const adminLink = document.getElementById('fnDrawerAdminLink');
    if (user && user.token) {
      if (txt) txt.innerText = user.name;
      if (adminLink) adminLink.style.display = (user.role === 'admin' || user.role === 'staff') ? '' : 'none';
    } else {
      if (txt) txt.innerText = 'Đăng Nhập';
      if (adminLink) adminLink.style.display = 'none';
    }
  }

  function initMobileDrawer() {
    ensureHamburger();
    buildDrawerNav();
    syncDrawerAuth(getSession());
  }

  window.fnCloseDrawer = fnCloseDrawer;
  window.fnToggleSub = fnToggleSub;

  function syncNav() {
    const user = getSession();
    const navbar = document.querySelector('header.navbar');
    const navLinks = document.querySelector('.nav-links');
    const adminLink = navLinks ? (document.getElementById('navManageLink') || navLinks.querySelector('a[href="admin.html"]')) : null;
    let loginBtn = document.getElementById('navAuthBtn') || document.getElementById('btnOpenAuth');
    if (!loginBtn && navbar) {
      // Chèn trực tiếp vào header.navbar (KHÔNG chèn vào .nav-links),
      // vì .nav-links bị display:none trên mobile (<=768px) sẽ ẩn mất nút này.
      navbar.insertAdjacentHTML('beforeend', `
        <button id="btnOpenAuth" class="btn btn-sm btn-outline-warning fn-auth-btn rounded-pill">
          <i class="fa-solid fa-user me-1"></i><span id="navUserText">Đăng Nhập</span>
        </button>
      `);
      loginBtn = document.getElementById('btnOpenAuth');
    }
    if (loginBtn) {
      loginBtn.setAttribute('data-bs-toggle', 'offcanvas');
      loginBtn.setAttribute('data-bs-target', '#authOffcanvas');
    }
    if (user && user.token) {
      if (adminLink) adminLink.style.display = (user.role === 'admin' || user.role === 'staff') ? '' : 'none';
      loginBtn.innerHTML = `<i class="fa-solid fa-circle-user text-success me-1"></i><span id="navUserText">${user.name}</span>`;
      // Giữ lại class fn-auth-btn (đã có style responsive riêng cho mobile trong admin-custom.css)
      loginBtn.className = 'btn btn-sm btn-warning fn-auth-btn rounded-pill text-dark fw-bold';
      document.getElementById('offcanvasLoginForm').classList.add('d-none');
      document.getElementById('offcanvasUserForm').classList.remove('d-none');
      document.getElementById('lblUserName').innerText = user.name;
      document.getElementById('lblUserRole').innerText = user.role === 'admin' ? 'Quản trị viên (admin)' : 'Nhân viên (staff)';
    } else {
      if (adminLink) adminLink.style.display = 'none';
      loginBtn.innerHTML = `<i class="fa-solid fa-lock me-1"></i><span id="navUserText">Đăng Nhập</span>`;
      // Giữ lại class fn-auth-btn (đã có style responsive riêng cho mobile trong admin-custom.css)
      loginBtn.className = 'btn btn-sm btn-outline-warning fn-auth-btn rounded-pill';
      document.getElementById('offcanvasLoginForm').classList.remove('d-none');
      document.getElementById('offcanvasUserForm').classList.add('d-none');
    }
    syncDrawerAuth(user);
  }

  window.FeeNoireAuth = {
    init() {
      syncNav();
      initMobileDrawer();
      window.addEventListener('DOMContentLoaded', () => { syncNav(); initMobileDrawer(); });
      document.addEventListener('hidden.bs.offcanvas', () => syncDrawerAuth(getSession()));
    },
    getSessionUser: getSession,
    getSession: getSession,
    toast: showToast,
    toggleDrawerSub: fnToggleSub,
    closeDrawer: fnCloseDrawer,
    openDrawer: fnOpenDrawer,

    async handleLogin(event) {
      event.preventDefault();
      const alertBox = document.getElementById('loginAlert');
      const btn = document.querySelector('#offcanvasLoginForm .btn-login-submit');
      const userInp = document.getElementById('authUsername')?.value?.trim();
      const passInp = document.getElementById('authPassword')?.value?.trim();
      if (!userInp || !passInp) {
        alertBox.innerText = 'Vui lòng điền đủ tài khoản & mật khẩu!';
        alertBox.classList.remove('d-none'); return;
      }
      alertBox.classList.add('d-none');
      btn.disabled = true; btn.innerText = 'Đang xác thực...';
      try {
        const response = await fetch(FEE_NOIRE_CONFIG.GAS_URL, {
          method: 'POST', mode: 'cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'login', username: userInp, password: passInp })
        });
        const data = await response.json();
        if (data.status === 'ok') {
          sessionStorage.setItem('fee_noire_session', JSON.stringify({
            username: data.user.username, name: data.user.name,
            role: data.user.role, token: data.token
          }));
          document.getElementById('authUsername').value = '';
          document.getElementById('authPassword').value = '';
          syncNav();
          getOffcanvasInstance()?.hide();
          window.dispatchEvent(new Event('fn:authChanged'));
          if (window.location.pathname.endsWith('admin.html')) {
            if (typeof checkAuth === 'function') checkAuth();
          } else { window.location.href = 'admin.html'; }
        } else {
          alertBox.innerText = data.message || 'Sai tài khoản hoặc mật khẩu!';
          alertBox.classList.remove('d-none');
        }
      } catch (_) {
        alertBox.innerText = 'Không thể kết nối với Cloud Google Sheets. Hãy kiểm tra lại mạng hoặc URL Deploy!';
        alertBox.classList.remove('d-none');
      }
      btn.disabled = false; btn.innerText = 'Đăng Nhập Hệ Thống';
    },

    async logout() {
      const user = getSession();
      if (user?.token) {
        await fetch(FEE_NOIRE_CONFIG.GAS_URL, {
          method: 'POST', mode: 'cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'logout', token: user.token })
        }).catch(() => {});
      }
      sessionStorage.removeItem('fee_noire_session');
      syncNav();
      getOffcanvasInstance()?.hide();
      window.dispatchEvent(new Event('fn:authChanged'));
      if (window.location.pathname.endsWith('admin.html')) {
        window.location.href = 'index.html';
      } else if (typeof checkAuth === 'function') { checkAuth(); }
    }
  };

  // ── HIỆU ỨNG CLICK TỎA NGÔI SAO ──
  document.addEventListener('click', function (e) {
    // Không tạo sao khi click vào thanh nhạc
    if (e.target.closest && e.target.closest('#fnMusicBar, #fnMusicMini')) return;
    const starTypes = ['✦', '✧', '★', '✶', '﹡'];
    const starCount = 6;
    for (let i = 0; i < starCount; i++) {
      const star = document.createElement('div');
      star.className = 'click-star';
      star.textContent = starTypes[Math.floor(Math.random() * starTypes.length)];
      star.style.left = e.clientX + 'px';
      star.style.top = e.clientY + 'px';
      const angle = Math.random() * Math.PI * 2;
      const velocity = 30 + Math.random() * 60;
      const x = Math.cos(angle) * velocity + 'px';
      const y = Math.sin(angle) * velocity + 'px';
      const rotate = (Math.random() * 360) + 'deg';
      star.style.setProperty('--x', x);
      star.style.setProperty('--y', y);
      star.style.setProperty('--r', rotate);
      star.style.fontSize = (10 + Math.random() * 10) + 'px';
      const colors = ['#bb86fc', '#e6c2ff', '#ffe066', '#ffffff'];
      star.style.color = colors[Math.floor(Math.random() * colors.length)];
      star.style.textShadow = `0 0 8px ${star.style.color}`;
      document.body.appendChild(star);
      setTimeout(() => { star.remove(); }, 800);
    }
  });

  window.FeeNoireAuth.init();
})();
