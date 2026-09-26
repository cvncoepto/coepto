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

export function getRoles(user) {
  return user?.app_metadata?.roles || [];
}

export function getDisplayName(user) {
  return user?.user_metadata?.full_name || user?.email || "";
}
