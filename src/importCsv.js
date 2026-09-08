// Đọc lại đúng định dạng CSV do exportCsv.js xuất ra, chuyển về danh sách công việc.

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // bỏ BOM nếu có
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // bỏ qua, xử lý ở \n
    } else if (char === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell !== ""));
}

function parseVNDate(str) {
  if (!str || str.trim() === "—" || str.trim() === "-") return "";
  const m = str.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  return `${y}-${mo}-${d}`;
}

/**
 * @param {string} text - nội dung file CSV
 * @param {{ groups: {key:string,label:string}[], genId: () => string }} opts
 * @returns {{ tasks: object[], errors: string[] }}
 */
export function importTasksFromCsv(text, { groups, genId }) {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { tasks: [], errors: ["File rỗng hoặc không có dữ liệu."] };
  }

  const header = rows[0].map((h) => h.trim());
  const idx = (name) => header.indexOf(name);
  const iTask = idx("Công việc");
  const iGroup = idx("Nhóm");
  const iGiao = idx("Ngày giao");
  const iHtdk = idx("Hạn hoàn thành");
  const iHt = idx("Ngày hoàn thành");
  const iBoi = idx("Hoàn thành bởi");

  if (iTask === -1 || iGroup === -1 || iGiao === -1 || iHtdk === -1) {
    return {
      tasks: [],
      errors: ["File CSV không đúng định dạng (thiếu cột bắt buộc). Hãy dùng đúng file đã xuất từ app này."],
    };
  }

  const tasks = [];
  const errors = [];

  rows.slice(1).forEach((r, i) => {
    const rowNum = i + 2;
    const taskName = (r[iTask] || "").trim();
    if (!taskName) return;

    const groupLabelRaw = (r[iGroup] || "").trim();
    const groupObj = groups.find((g) => g.label === groupLabelRaw);
    if (!groupObj) {
      errors.push(`Dòng ${rowNum}: không nhận diện được nhóm "${groupLabelRaw}".`);
      return;
    }

    const ngayGiao = parseVNDate(r[iGiao]);
    const ngayHoanThanhDuKien = parseVNDate(r[iHtdk]);
    if (!ngayGiao || !ngayHoanThanhDuKien) {
      errors.push(`Dòng ${rowNum}: "Ngày giao" hoặc "Hạn hoàn thành" không đúng định dạng dd/mm/yyyy.`);
      return;
    }

    const ngayHoanThanh = iHt !== -1 ? parseVNDate(r[iHt]) : "";
    const hoanThanhBoiRaw = iBoi !== -1 ? (r[iBoi] || "").trim() : "";
    const hoanThanhBoi = hoanThanhBoiRaw === "—" ? "" : hoanThanhBoiRaw;

    tasks.push({
      id: genId(),
      group: groupObj.key,
      task: taskName,
      ngayGiao,
      ngayHoanThanhDuKien,
      ngayHoanThanh,
      hoanThanhBoi,
    });
  });

  return { tasks, errors };
}
