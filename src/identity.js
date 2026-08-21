// Wrapper mỏng quanh window.netlifyIdentity (nạp qua thẻ <script> trong index.html).
// Netlify Identity tự lo việc hiển thị nút "Log in with Google" trong modal đăng nhập
// MIỄN LÀ Google đã được bật làm External Provider trong Netlify: Site settings >
// Identity > Settings and usage > External providers > Google.

/**
 * Khởi tạo Identity và lắng nghe các sự kiện init/login/logout.
 * @param {(user: object|null) => void} onUserChange
 * @returns {object|null} instance của netlifyIdentity, hoặc null nếu script chưa load.
 */
export function initIdentity(onUserChange) {
  const identity = window.netlifyIdentity;
  if (!identity) {
    console.warn(
      "Netlify Identity widget chưa được nạp. Kiểm tra thẻ <script src=\"https://identity.netlify.com/v1/netlify-identity-widget.js\"> trong index.html."
    );
    return null;
  }

  identity.on("init", (user) => onUserChange(user || null));
  identity.on("login", (user) => {
    onUserChange(user || null);
    identity.close();
  });
  identity.on("logout", () => onUserChange(null));

  identity.init();
  return identity;
}

export function openLogin() {
  window.netlifyIdentity?.open("login");
}

export function logout() {
  window.netlifyIdentity?.logout();
}

/**
 * Đọc danh sách role được gán cho user trong Netlify Identity.
 * Role KHÔNG thể tự set từ phía client (vì lý do bảo mật) - phải được
 * admin gán thủ công trong Netlify dashboard: Identity > Users > chọn user >
 * thêm role vào ô "Roles", ví dụ: giam_sat
 */
export function getRoles(user) {
  return user?.app_metadata?.roles || [];
}

export function getDisplayName(user) {
  return user?.user_metadata?.full_name || user?.email || "";
}
