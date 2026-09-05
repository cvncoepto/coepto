function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/**
 * Xuất danh sách công việc ra file .csv và tự động tải xuống.
 * @param {Array} tasks
 * @param {(task: object) => string} groupLabel
 * @param {(task: object) => {label: string}} getStatusMeta
 * @param {(iso: string) => string} formatDate
 */
export function exportTasksToCsv(tasks, groupLabel, getStatusMeta, formatDate) {
  const headers = ["Công việc", "Nhóm", "Ngày giao", "Hạn hoàn thành", "Ngày hoàn thành", "Trạng thái"];
  const rows = tasks.map((t) => [
    t.task,
    groupLabel(t.group),
    formatDate(t.ngayGiao),
    formatDate(t.ngayHoanThanhDuKien),
    formatDate(t.ngayHoanThanh),
    getStatusMeta(t).label,
  ]);

  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(","));
  // Thêm BOM (\uFEFF) để Excel hiển thị đúng tiếng Việt có dấu.
  const csvContent = "\uFEFF" + lines.join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `cong-viec-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
