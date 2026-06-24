// =============================================================================
//  FÉE NOIRE — config.js
//  Cấu hình chung toàn hệ thống. Nhúng TRƯỚC auth.js trên mọi trang.
// =============================================================================

const FEE_NOIRE_CONFIG = {
  // URL Web App đã Deploy từ Google Apps Script (Code.gs)
  // Lấy tại: Apps Script > Deploy > Manage deployments > copy "Web app URL"
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyONpEOLsMb0QwdIbCaHPiY7vCjTSK5TBosoUMUFKMnE0Ityv7kIVgxCotG69x4F0hP/exec',

  // API Key miễn phí của imgbb.com — dùng để upload ảnh từ máy trong trang Admin
  // Lấy tại: https://api.imgbb.com/ (đăng nhập bằng email, copy "API Key")
  IMGBB_API_KEY: '143b446a1ce2e20af4a941d6f31aee80'
};

// Cho phép auth.js và admin.html truy cập qua window.FEE_NOIRE_CONFIG
window.FEE_NOIRE_CONFIG = FEE_NOIRE_CONFIG;