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
