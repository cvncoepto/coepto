import { getStore, connectLambda } from "@netlify/blobs";

const STORE_NAME = "tasks-store";
const KEY = "tasks";
const SUPERVISOR_ROLE = "giam_sat";

function isSupervisor(context) {
  const roles = context?.clientContext?.user?.app_metadata?.roles || [];
  return roles.includes(SUPERVISOR_ROLE);
}

// ===== Sao lưu tự động =====
// Trước khi ghi đè danh sách, bản hiện tại được lưu thành "backup/<thời điểm>__<lý do>__<số việc>".
// - Nhập file / khôi phục: LUÔN sao lưu.
// - Thêm / sửa / xóa thường: tối đa 1 bản mỗi 30 phút (tránh quá nhiều bản).
// Giữ tối đa MAX_BACKUPS bản mới nhất. Tick hoàn thành (PATCH) không tạo bản sao lưu.
const BACKUP_PREFIX = "backup/";
const MAX_BACKUPS = 40;
const ROUTINE_BACKUP_GAP_MS = 30 * 60 * 1000;
const ALWAYS_BACKUP_REASONS = ["import", "restore"];
const REASONS = ["import", "restore", "edit"];

function parseBackupKey(key) {
  // backup/2026-11-19T08-30-00-000Z__import__42
  const m = key.slice(BACKUP_PREFIX.length).match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z__([a-z]+)__(\d+)$/);
  if (!m) return null;
  const [, date, hh, mm, ss, ms, reason, count] = m;
  return { key, at: `${date}T${hh}:${mm}:${ss}.${ms}Z`, reason, count: Number(count) };
}

async function listBackups(store) {
  const { blobs } = await store.list({ prefix: BACKUP_PREFIX });
  return blobs
    .map((b) => parseBackupKey(b.key))
    .filter(Boolean)
    .sort((a, b) => (a.at < b.at ? 1 : -1)); // mới nhất trước
}

async function backupCurrent(store, currentTasks, reason) {
  if (!Array.isArray(currentTasks) || currentTasks.length === 0) return; // không có gì để giữ
  const backups = await listBackups(store);
  if (!ALWAYS_BACKUP_REASONS.includes(reason) && backups[0]) {
    if (Date.now() - new Date(backups[0].at).getTime() < ROUTINE_BACKUP_GAP_MS) return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await store.setJSON(`${BACKUP_PREFIX}${stamp}__${reason}__${currentTasks.length}`, currentTasks);
  const extra = backups.slice(MAX_BACKUPS - 1);
  await Promise.all(extra.map((b) => store.delete(b.key)));
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
    const q = event.queryStringParameters || {};
    if (q.backups !== undefined || q.backup) {
      if (!isSupervisor(context)) {
        return json({ error: "Chỉ Giám sát mới xem được bản sao lưu." }, 403);
      }
      if (q.backup) {
        if (!q.backup.startsWith(BACKUP_PREFIX) || !parseBackupKey(q.backup)) {
          return json({ error: "Bản sao lưu không hợp lệ." }, 400);
        }
        const data = await store.get(q.backup, { type: "json" });
        if (!data) return json({ error: "Không tìm thấy bản sao lưu." }, 404);
        return json(data);
      }
      return json(await listBackups(store));
    }
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
    const reason = REASONS.includes(body.reason) ? body.reason : "edit";
    try {
      const current = (await store.get(KEY, { type: "json" })) || [];
      await backupCurrent(store, current, reason);
    } catch (e) {
      // Nhập file / khôi phục mà không sao lưu được thì DỪNG, không ghi đè.
      if (ALWAYS_BACKUP_REASONS.includes(reason)) {
        return json({ error: "Không tạo được bản sao lưu nên chưa ghi dữ liệu. Vui lòng thử lại." }, 500);
      }
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
