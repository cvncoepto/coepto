// Tính trước kết quả nhập file theo 3 chế độ, KHÔNG ghi gì cả.
// App hiển thị kết quả này để người dùng xem trước rồi mới bấm áp dụng.
//
// Ghép một dòng trong file với một công việc đang có:
//   1. Theo ID (file xuất từ phiên bản mới có cột ID).
//   2. Nếu không có ID khớp: theo Tên công việc + Nhóm + Ngày giao
//      (không phân biệt hoa thường, dấu, khoảng trắng thừa).
//
// Chế độ:
//   replace — Thay thế: danh sách mới = đúng nội dung file. Việc không có trong file sẽ bị XÓA.
//   append  — Gộp: chỉ THÊM việc trong file chưa có. Không sửa, không xóa việc đang có.
//   smart   — Gộp thông minh: thêm việc mới + CẬP NHẬT việc đã có theo file.
//             Không bao giờ xóa việc, không xóa nội dung đang có bằng ô trống,
//             không bỏ trạng thái "hoàn thành" của việc đã hoàn thành.

export const IMPORT_MODES = {
  smart: {
    label: "Gộp thông minh",
    short: "Thêm việc mới và cập nhật việc đã có. Không xóa gì.",
  },
  append: {
    label: "Gộp",
    short: "Chỉ thêm việc chưa có. Giữ nguyên mọi việc đang có.",
  },
  replace: {
    label: "Thay thế",
    short: "Danh sách mới đúng bằng file. Việc không có trong file sẽ bị xóa.",
  },
};

const FIELDS = ["task", "moTa", "group", "ngayGiao", "ngayHoanThanhDuKien"];
const FIELD_LABELS = {
  task: "tên",
  moTa: "mô tả",
  group: "nhóm",
  ngayGiao: "ngày giao",
  ngayHoanThanhDuKien: "hạn hoàn thành",
  ngayHoanThanh: "hoàn thành",
};

function norm(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function matchKey(t) {
  return `${norm(t.task)}|${t.group}|${t.ngayGiao || ""}`;
}

function clean(t) {
  const { fromFileId, ...rest } = t;
  return rest;
}

// Gộp thông minh một cặp (đang có, trong file). Trả về { merged, changed: [tên trường] }
function smartMergeOne(cur, inc) {
  const merged = { ...cur };
  const changed = [];
  for (const f of FIELDS) {
    const v = String(inc[f] ?? "").trim();
    if (v && v !== String(cur[f] ?? "").trim()) {
      merged[f] = inc[f];
      changed.push(f);
    }
  }
  if (inc.ngayHoanThanh && !cur.ngayHoanThanh) {
    // File ghi đã hoàn thành, hiện tại chưa: đánh dấu hoàn thành
    merged.ngayHoanThanh = inc.ngayHoanThanh;
    merged.hoanThanhBoi = inc.hoanThanhBoi || cur.hoanThanhBoi || "";
    changed.push("ngayHoanThanh");
  } else if (cur.ngayHoanThanh && !cur.hoanThanhBoi && inc.hoanThanhBoi) {
    merged.hoanThanhBoi = inc.hoanThanhBoi;
  }
  // File ghi chưa hoàn thành nhưng hiện tại đã hoàn thành: GIỮ hoàn thành.
  return { merged, changed };
}

export function computeImportPlan(current, imported, mode) {
  const curById = new Map(current.map((t) => [t.id, t]));
  const curByKey = new Map();
  for (const t of current) {
    const k = matchKey(t);
    if (!curByKey.has(k)) curByKey.set(k, t);
  }

  const usedCurIds = new Set();
  const pairs = []; // { cur, inc }
  const fresh = []; // việc trong file chưa có
  let duplicatesInFile = 0;
  const seenKeys = new Set();

  for (const inc of imported) {
    const k = matchKey(inc);
    let cur = null;
    if (inc.fromFileId && curById.has(inc.id) && !usedCurIds.has(inc.id)) cur = curById.get(inc.id);
    if (!cur) {
      const byKey = curByKey.get(k);
      if (byKey && !usedCurIds.has(byKey.id)) cur = byKey;
    }
    if (cur) {
      usedCurIds.add(cur.id);
      pairs.push({ cur, inc });
      seenKeys.add(k);
      continue;
    }
    // Không khớp việc đang có: bỏ qua nếu trùng y hệt một dòng khác trong file
    if (seenKeys.has(k)) {
      duplicatesInFile++;
      continue;
    }
    seenKeys.add(k);
    // Tránh ID trong file trùng với một việc đang có khác
    const inc2 = curById.has(inc.id) ? { ...inc, id: `${inc.id}-${Math.random().toString(36).slice(2, 8)}` } : inc;
    fresh.push(clean(inc2));
  }

  const added = fresh;
  const updated = []; // { before, after, changed }
  const unchanged = [];
  let removed = [];
  let result;

  if (mode === "replace") {
    // Giữ ID của việc đang có để các thao tác khác không bị lệch
    const kept = pairs.map(({ cur, inc }) => {
      const after = { ...clean(inc), id: cur.id };
      const changed = [...FIELDS, "ngayHoanThanh", "hoanThanhBoi"].filter(
        (f) => String(after[f] ?? "") !== String(cur[f] ?? "")
      );
      if (changed.length) updated.push({ before: cur, after, changed });
      else unchanged.push(cur);
      return after;
    });
    removed = current.filter((t) => !usedCurIds.has(t.id));
    result = [...kept, ...added];
  } else if (mode === "append") {
    pairs.forEach(({ cur }) => unchanged.push(cur));
    result = [...current, ...added];
  } else {
    const mergedById = new Map();
    pairs.forEach(({ cur, inc }) => {
      const { merged, changed } = smartMergeOne(cur, inc);
      if (changed.length) {
        updated.push({ before: cur, after: merged, changed });
        mergedById.set(cur.id, merged);
      } else unchanged.push(cur);
    });
    result = [...current.map((t) => mergedById.get(t.id) || t), ...added];
  }

  return {
    mode,
    result,
    added,
    updated,
    unchanged,
    removed,
    duplicatesInFile,
    matched: pairs.length,
  };
}

// Số việc theo nhóm, trước và sau, kèm nhóm bị thiếu trong file
export function groupSummary(current, imported, result, groups) {
  const count = (list, key) => list.filter((t) => t.group === key).length;
  const rows = groups.map((g) => ({
    key: g.key,
    label: g.label,
    before: count(current, g.key),
    inFile: count(imported, g.key),
    after: count(result, g.key),
  }));
  const missingGroups = rows.filter((r) => r.before > 0 && r.inFile === 0);
  return { rows, missingGroups };
}

export function describeChanges(changed) {
  return changed.map((f) => FIELD_LABELS[f] || f).filter((v, i, a) => a.indexOf(v) === i).join(", ");
}

export function normalizeConfirm(str) {
  return norm(str).toUpperCase();
}
