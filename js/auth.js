// =============================================================================
//  FÉE NOIRE — auth.js (BẢN CHUẨN HÓA KẾT NỐI VÀ ĐỒNG BỘ GOOGLE SHEETS)
//  Nhúng vào TẤT CẢ trang. Tự động:
//   - Inject offcanvas đăng nhập hệ thống kết nối trực tiếp Google Sheets
//   - Hiển thị/ẩn link "Quản Lý" trên nav dựa trên session đồng bộ
//   - Xử lý login / logout tập trung qua GAS_URL dạng POST text/plain
// =============================================================================

(function () {
  // ── Inject Offcanvas HTML vào cuối body ────────────────────────────────────
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
        &copy; 2026 Fée Noire • Hệ thống đồng bộ dữ liệu đám mây
      </div>
    </div>
  </div>
  `;

  document.body.insertAdjacentHTML('beforeend', offcanvasHTML);

  // ── Inject Toast Container dùng chung toàn hệ thống ────────────────────────
  const toastCSS = `
  <style id="feeNoireToastStyle">
    #fnToastStack {
      position: fixed;
      top: 90px;
      right: 20px;
      z-index: 2000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 340px;
    }
    .fn-toast {
      background: rgba(14, 11, 20, 0.92);
      border: 1px solid rgba(187, 134, 252, 0.3);
      border-left: 4px solid var(--accent-glow, #bb86fc);
      color: #f5f6fa;
      border-radius: 12px;
      padding: 13px 16px;
      font-family: 'Quicksand', sans-serif;
      font-size: 0.9rem;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
      display: flex;
      align-items: flex-start;
      gap: 10px;
      animation: fnToastIn 0.25s ease forwards;
      opacity: 0;
      transform: translateX(20px);
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

  // ── HELPER UTILITIES ───────────────────────────────────────────────────────
  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem('fee_noire_session'));
    } catch (_) {
      return null;
    }
  }

  function getOffcanvasInstance() {
    const el = document.getElementById('authOffcanvas');
    if (!el || !window.bootstrap) return null;
    return bootstrap.Offcanvas.getInstance(el) || new bootstrap.Offcanvas(el);
  }

  function syncNav() {
    const user = getSession();
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    // Tìm link Quản Lý (có thể là navManageLink hoặc a[href="admin.html"] trong nav)
    const adminLink = document.getElementById('navManageLink') || navLinks.querySelector('a[href="admin.html"]');

    // 1. Ưu tiên tìm nút có sẵn trên HTML (navAuthBtn), nếu không có mới tìm btnOpenAuth
    let loginBtn = document.getElementById('navAuthBtn') || document.getElementById('btnOpenAuth');

    // 2. Nếu hoàn toàn không có nút nào, tạo mới
    if (!loginBtn) {
      navLinks.insertAdjacentHTML('beforeend', `
        <button id="btnOpenAuth" class="btn btn-sm btn-outline-warning ms-3 px-3 rounded-pill">
          <i class="fa-solid fa-user me-1"></i>Đăng Nhập
        </button>
      `);
      loginBtn = document.getElementById('btnOpenAuth');
    }

    // 3. Đảm bảo nút luôn mở được Offcanvas
    if (loginBtn) {
      loginBtn.setAttribute('data-bs-toggle', 'offcanvas');
      loginBtn.setAttribute('data-bs-target', '#authOffcanvas');
    }

    // 4. Xử lý trạng thái đăng nhập / đăng xuất
    if (user && user.token) {
      // Hiện link Quản Lý nếu là admin hoặc staff
      if (adminLink) {
        adminLink.style.display = (user.role === 'admin' || user.role === 'staff') ? '' : 'none';
      }

      loginBtn.innerHTML = `<i class="fa-solid fa-circle-user text-success me-1"></i>${user.name}`;
      loginBtn.className = 'btn btn-sm btn-warning ms-3 px-3 rounded-pill text-dark fw-bold';

      // Cập nhật span navUserText nếu có (dùng trên index/banggia)
      const userText = document.getElementById('navUserText');
      if (userText) userText.innerText = user.name;

      document.getElementById('offcanvasLoginForm').classList.add('d-none');
      document.getElementById('offcanvasUserForm').classList.remove('d-none');
      document.getElementById('lblUserName').innerText = user.name;
      document.getElementById('lblUserRole').innerText = user.role === 'admin' ? 'Quản trị viên (admin)' : 'Nhân viên (staff)';
    } else {
      // Ẩn link Quản Lý
      if (adminLink) adminLink.style.display = 'none';

      loginBtn.innerHTML = `<i class="fa-solid fa-lock me-1"></i>Đăng Nhập`;
      loginBtn.className = 'btn btn-sm btn-outline-warning ms-3 px-3 rounded-pill';

      const userText = document.getElementById('navUserText');
      if (userText) userText.innerText = 'Đăng Nhập';

      document.getElementById('offcanvasLoginForm').classList.remove('d-none');
      document.getElementById('offcanvasUserForm').classList.add('d-none');
    }
  }

  // ── GLOBAL INTERFACE ───────────────────────────────────────────────────────
  window.FeeNoireAuth = {
    init() {
      syncNav();
      window.addEventListener('DOMContentLoaded', syncNav);
    },

    getSessionUser: getSession,
    // Alias: admin.html gọi FeeNoireAuth.getSession() — giữ cả 2 tên để tương thích, tránh lỗi runtime
    getSession: getSession,

    // Toast thông báo đẹp dùng chung toàn hệ thống, thay cho alert()
    toast: showToast,

    async handleLogin(event) {
      event.preventDefault();
      const alertBox = document.getElementById('loginAlert');
      const btn = document.querySelector('#offcanvasLoginForm .btn-login-submit');

      const userInp = document.getElementById('authUsername')?.value?.trim();
      const passInp = document.getElementById('authPassword')?.value?.trim();

      if (!userInp || !passInp) {
        alertBox.innerText = 'Vui lòng điền đủ tài khoản & mật khẩu!';
        alertBox.classList.remove('d-none');
        return;
      }

      alertBox.classList.add('d-none');
      btn.disabled = true;
      btn.innerText = 'Đang xác thực...';

      try {
        const response = await fetch(FEE_NOIRE_CONFIG.GAS_URL, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({
            action: 'login',
            username: userInp,
            password: passInp
          })
        });

        const data = await response.json();

        if (data.status === 'ok') {
          sessionStorage.setItem('fee_noire_session', JSON.stringify({
            username: data.user.username,
            name: data.user.name,
            role: data.user.role,
            token: data.token
          }));

          document.getElementById('authUsername').value = '';
          document.getElementById('authPassword').value = '';

          syncNav();
          getOffcanvasInstance()?.hide();

          // Nếu đang ở trang admin rồi thì gọi checkAuth() để render dashboard ngay
          if (window.location.pathname.endsWith('admin.html')) {
            if (typeof checkAuth === 'function') checkAuth();
          } else {
            window.location.href = 'admin.html';
          }
        } else {
          alertBox.innerText = data.message || 'Sai tài khoản hoặc mật khẩu!';
          alertBox.classList.remove('d-none');
        }
      } catch (_) {
        alertBox.innerText = 'Không thể kết nối với Cloud Google Sheets. Hãy kiểm tra lại mạng hoặc URL Deploy!';
        alertBox.classList.remove('d-none');
      }

      btn.disabled = false;
      btn.innerText = 'Đăng Nhập Hệ Thống';
    },

    async logout() {
      const user = getSession();
      if (user?.token) {
        await fetch(FEE_NOIRE_CONFIG.GAS_URL, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'logout', token: user.token })
        }).catch(() => { });
      }

      sessionStorage.removeItem('fee_noire_session');
      syncNav();
      getOffcanvasInstance()?.hide();

      if (window.location.pathname.endsWith('admin.html')) {
        window.location.href = 'index.html';
      } else if (typeof checkAuth === 'function') {
        checkAuth();
      }
    }
  };

  // ── HIỆU ỨNG CLICK TỎA NGÔI SAO ──
  document.addEventListener('click', function (e) {
    // Danh sách các ký tự ngôi sao lấp lánh phong cách Sky
    const starTypes = ['✦', '✧', '★', '✶', '﹡'];
    // Số lượng ngôi sao tỏa ra mỗi lần click
    const starCount = 6;

    for (let i = 0; i < starCount; i++) {
      const star = document.createElement('div');
      star.className = 'click-star';

      // Chọn ngẫu nhiên hình dáng ngôi sao
      star.textContent = starTypes[Math.floor(Math.random() * starTypes.length)];

      // Vị trí click của chuột
      star.style.left = e.clientX + 'px';
      star.style.top = e.clientY + 'px';

      // Tính toán hướng bay ngẫu nhiên (tỏa ra vòng tròn xung quanh tâm click)
      const angle = Math.random() * Math.PI * 2;
      const velocity = 30 + Math.random() * 60; // Độ xa ngẫu nhiên
      const x = Math.cos(angle) * velocity + 'px';
      const y = Math.sin(angle) * velocity + 'px';
      const rotate = (Math.random() * 360) + 'deg'; // Độ xoay ngẫu nhiên

      // Truyền biến vào CSS
      star.style.setProperty('--x', x);
      star.style.setProperty('--y', y);
      star.style.setProperty('--r', rotate);

      // Kích thước ngẫu nhiên một chút cho tự nhiên
      star.style.fontSize = (10 + Math.random() * 10) + 'px';

      // Đổi màu sắc ngẫu nhiên nhẹ giữa vàng tinh tú và tím huyền bí của Fée Noire
      const colors = ['#bb86fc', '#e6c2ff', '#ffe066', '#ffffff'];
      star.style.color = colors[Math.floor(Math.random() * colors.length)];
      star.style.textShadow = `0 0 8px ${star.style.color}`;

      document.body.appendChild(star);

      // Tự động xóa ngôi sao sau khi chạy xong hiệu ứng để tránh nặng web
      setTimeout(() => {
        star.remove();
      }, 800);
    }
  });

  window.FeeNoireAuth.init();
})();