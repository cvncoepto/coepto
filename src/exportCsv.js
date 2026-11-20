function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function stamp(withTime) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return withTime ? `${date}-${p(d.getHours())}${p(d.getMinutes())}` : date;
}

// Luôn xuất TOÀN BỘ công việc được truyền vào (App truyền tất cả nhóm, không theo tab/bộ lọc).
// groupOrder: thứ tự nhóm để sắp xếp. Cột "ID" cuối cùng giúp lần nhập sau ghép đúng công việc.
// filePrefix: tên file, mặc định "cong-viec-tat-ca"; bản sao lưu dùng "sao-luu-truoc-khi-nhap".
export function exportTasksToCsv(tasks, groupLabel, getStatusMeta, formatDate, { groupOrder = [], filePrefix = "cong-viec-tat-ca" } = {}) {
  const orderOf = (g) => {
    const i = groupOrder.indexOf(g);
    return i === -1 ? groupOrder.length : i;
  };
  const sorted = [...tasks].sort(
    (a, b) => orderOf(a.group) - orderOf(b.group) || String(a.ngayGiao || "").localeCompare(String(b.ngayGiao || ""))
  );

  const headers = ["Công việc", "Mô tả", "Nhóm", "Ngày giao", "Hạn hoàn thành", "Ngày hoàn thành", "Hoàn thành bởi", "Trạng thái", "ID"];
  const rows = sorted.map((t) => [
    t.task,
    t.moTa || "",
    groupLabel(t.group),
    formatDate(t.ngayGiao),
    formatDate(t.ngayHoanThanhDuKien),
    formatDate(t.ngayHoanThanh),
    t.hoanThanhBoi || "—",
    getStatusMeta(t).label,
    t.id || "",
  ]);

  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(","));
  const csvContent = "﻿" + lines.join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fileName = `${filePrefix}-${stamp(filePrefix !== "cong-viec-tat-ca")}.csv`;
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { fileName, count: sorted.length };
}
