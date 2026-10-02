function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function exportTasksToCsv(tasks, groupLabel, getStatusMeta, formatDate) {
  const headers = ["Công việc", "Mô tả", "Nhóm", "Ngày giao", "Hạn hoàn thành", "Ngày hoàn thành", "Hoàn thành bởi", "Trạng thái"];
  const rows = tasks.map((t) => [
    t.task,
    t.moTa || "",
    groupLabel(t.group),
    formatDate(t.ngayGiao),
    formatDate(t.ngayHoanThanhDuKien),
    formatDate(t.ngayHoanThanh),
    t.hoanThanhBoi || "—",
    getStatusMeta(t).label,
  ]);

  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(","));
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
