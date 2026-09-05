import { getStore, connectLambda } from "@netlify/blobs";

const STORE_NAME = "tasks-store";
const KEY = "tasks";
const SUPERVISOR_ROLE = "giam_sat";

function isSupervisor(context) {
  const roles = context?.clientContext?.user?.app_metadata?.roles || [];
  return roles.includes(SUPERVISOR_ROLE);
}

function json(data, statusCode = 200) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(data),
  };
}

// Lưu ý quan trọng (đừng xóa nếu sau này chỉnh sửa file này):
// 1. Dùng cú pháp Function V1 (event, context kiểu Lambda) thay vì V2
//    (Request/Response) — vì chỉ V1 mới đọc được context.clientContext.user
//    (thông tin đăng nhập Netlify Identity, bao gồm role).
// 2. Vì dùng V1 ("Lambda compatibility mode"), Netlify Blobs KHÔNG tự nhận diện
//    môi trường — bắt buộc phải gọi connectLambda(event) trước getStore(),
//    nếu không sẽ báo lỗi "MissingBlobsEnvironmentError".
export const handler = async (event, context) => {
  connectLambda(event);
  const store = getStore(STORE_NAME);

  // Đọc danh sách công việc — công khai, ai cũng xem được (không cần đăng nhập).
  if (event.httpMethod === "GET") {
    const tasks = (await store.get(KEY, { type: "json" })) || [];
    return json(tasks);
  }

  // Ghi đè toàn bộ danh sách — dùng khi Giám sát thêm/sửa/xóa công việc.
  // Bắt buộc phải có role "giam_sat" trong Netlify Identity.
  if (event.httpMethod === "POST") {
    if (!isSupervisor(context)) {
      return json({ error: "Chỉ Giám sát mới có quyền thêm/sửa/xóa công việc." }, 403);
    }
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json({ error: "Dữ liệu không hợp lệ." }, 400);
    }
    if (!Array.isArray(body?.tasks)) {
      return json({ error: "Dữ liệu không hợp lệ." }, 400);
    }
    await store.setJSON(KEY, body.tasks);
    return json(body.tasks);
  }

  // Tick / bỏ tick hoàn thành — cho phép mọi người dùng (không cần role đặc biệt),
  // vì đây là quyền chung của cả 3 nhóm CHỨC/TÙNG/TRƯỜNG.
  if (event.httpMethod === "PATCH") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json({ error: "Dữ liệu không hợp lệ." }, 400);
    }
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
