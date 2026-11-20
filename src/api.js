async function authHeader() {
  const user = window.netlifyIdentity?.currentUser();
  if (!user) return {};
  try {
    const token = await user.jwt();
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

// reason: "edit" (thêm/sửa/xóa) | "import" (nhập file) | "restore" (khôi phục / hoàn tác)
// Với "import" và "restore", máy chủ luôn sao lưu bản hiện tại trước khi ghi đè.
export async function replaceTasks(tasks, reason = "edit") {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ tasks, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Lưu dữ liệu thất bại.");
  }
  return res.json();
}

// changes: [{ id, done: true|false, today, by }]
export async function setTasksComplete(changes) {
  const res = await fetch("/api/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ changes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Cập nhật trạng thái thất bại.");
  }
  return res.json();
}

export async function listBackups() {
  const res = await fetch("/api/tasks?backups=1", { headers: { ...(await authHeader()) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Không tải được danh sách bản sao lưu.");
  }
  return res.json();
}

export async function fetchBackup(key) {
  const res = await fetch(`/api/tasks?backup=${encodeURIComponent(key)}`, { headers: { ...(await authHeader()) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Không tải được bản sao lưu.");
  }
  return res.json();
}
