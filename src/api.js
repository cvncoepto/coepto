// Client wrapper cho Netlify Function /api/tasks (netlify/functions/tasks.js).
// Dữ liệu được lưu thật trong Netlify Blobs, dùng chung cho mọi người truy cập site.

async function authHeader() {
  const user = window.netlifyIdentity?.currentUser();
  if (!user) return {};
  try {
    const token = await user.jwt(); // tự refresh token nếu cần
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

export async function fetchTasks() {
  const res = await fetch("/api/tasks");
  if (!res.ok) throw new Error("Không tải được dữ liệu công việc.");
  return res.json();
}

// Ghi đè toàn bộ danh sách — chỉ Giám sát mới gọi được (server sẽ kiểm tra lại role).
export async function replaceTasks(tasks) {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ tasks }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Lưu dữ liệu thất bại.");
  }
  return res.json();
}

// Tick / bỏ tick hoàn thành — ai cũng gọi được. "by" là tên người thực hiện, dùng để truy vết.
export async function toggleTaskComplete(id, todayIso, by) {
  const res = await fetch("/api/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ id, today: todayIso, by }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Cập nhật trạng thái thất bại.");
  }
  return res.json();
}
