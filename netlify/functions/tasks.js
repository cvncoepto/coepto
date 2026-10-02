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

  if (event.httpMethod === "GET") {
    const tasks = (await store.get(KEY, { type: "json" })) || [];
    return json(tasks);
  }

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

  if (event.httpMethod === "PATCH") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json({ error: "Dữ liệu không hợp lệ." }, 400);
    }
    // Định dạng mới: { changes: [{ id, done, today, by }] } — đặt trạng thái RÕ RÀNG
    // (hoàn thành / chưa hoàn thành) thay vì "đảo ngược", nên đọc phải dữ liệu cũ
    // cũng không làm đảo sai. Client gửi kèm mọi thay đổi gần đây của mình, nên
    // lần ghi sau không xóa mất lần ghi trước.
    // Định dạng cũ: { id, today, by } — vẫn hỗ trợ (đảo trạng thái).
    const changes = Array.isArray(body?.changes)
      ? body.changes
      : body?.id
        ? [{ id: body.id, today: body.today, by: body.by }]
        : null;
    if (!changes || changes.length === 0 || changes.some((c) => !c?.id)) {
      return json({ error: "Thiếu id công việc." }, 400);
    }
    const byId = new Map(changes.map((c) => [c.id, c]));

    const tasks = (await store.get(KEY, { type: "json" })) || [];
    const updated = tasks.map((t) => {
      const c = byId.get(t.id);
      if (!c) return t;
      const willComplete = typeof c.done === "boolean" ? c.done : !t.ngayHoanThanh;
      if (willComplete && t.ngayHoanThanh) return t; // đã hoàn thành sẵn: giữ ngày/người cũ
      return {
        ...t,
        ngayHoanThanh: willComplete ? c.today : "",
        hoanThanhBoi: willComplete ? (c.by || "Không xác định") : "",
      };
    });
    await store.setJSON(KEY, updated);
    return json(updated);
  }

  return json({ error: "Method not allowed" }, 405);
};
