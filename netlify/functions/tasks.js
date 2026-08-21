import { getStore } from "@netlify/blobs";

const STORE_NAME = "tasks-store";
const KEY = "tasks";
const SUPERVISOR_ROLE = "giam_sat";

function isSupervisor(context) {
  const roles = context?.clientContext?.user?.app_metadata?.roles || [];
  return roles.includes(SUPERVISOR_ROLE);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export default async (req, context) => {
  const store = getStore(STORE_NAME);

  // Đọc danh sách công việc — công khai, ai cũng xem được (không cần đăng nhập).
  if (req.method === "GET") {
    const tasks = (await store.get(KEY, { type: "json" })) || [];
    return json(tasks);
  }

  // Ghi đè toàn bộ danh sách — dùng khi Giám sát thêm/sửa/xóa công việc.
  // Bắt buộc phải có role "giam_sat" trong Netlify Identity.
  if (req.method === "POST") {
    if (!isSupervisor(context)) {
      return json({ error: "Chỉ Giám sát mới có quyền thêm/sửa/xóa công việc." }, 403);
    }
    const body = await req.json();
    if (!Array.isArray(body?.tasks)) {
      return json({ error: "Dữ liệu không hợp lệ." }, 400);
    }
    await store.setJSON(KEY, body.tasks);
    return json(body.tasks);
  }

  // Tick / bỏ tick hoàn thành — cho phép mọi người dùng (không cần role đặc biệt),
  // vì đây là quyền chung của cả 3 nhóm CHỨC/TÙNG/TRƯỜNG.
  if (req.method === "PATCH") {
    const body = await req.json();
    if (!body?.id) return json({ error: "Thiếu id công việc." }, 400);

    const tasks = (await store.get(KEY, { type: "json" })) || [];
    const updated = tasks.map((t) =>
      t.id === body.id ? { ...t, ngayHoanThanh: t.ngayHoanThanh ? "" : body.today } : t
    );
    await store.setJSON(KEY, updated);
    return json(updated);
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = {
  path: "/api/tasks",
};
