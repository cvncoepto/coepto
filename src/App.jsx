import React, { useState, useEffect, useMemo } from "react";
import { initIdentity, openLogin, logout, getRoles, getDisplayName } from "./identity";
import { fetchTasks, replaceTasks, toggleTaskComplete } from "./api";
import { exportTasksToCsv } from "./exportCsv";

const GROUPS = [
  { key: "CHUC", label: "CHỨC" },
  { key: "TUNG", label: "TÙNG" },
  { key: "TRUONG", label: "TRƯỜNG" },
];
const groupLabel = (k) => GROUPS.find((g) => g.key === k)?.label || k;

const SUPERVISOR_ROLE = "giam_sat";

function isoOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function getStatus(task) {
  if (task.ngayHoanThanh) return "completed";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (task.ngayHoanThanhDuKien) {
    const due = new Date(task.ngayHoanThanhDuKien);
    if (due < today) return "overdue";
  }
  return "pending";
}

const STATUS_META = {
  completed: { label: "Hoàn thành", color: "#12805C", bg: "#E7F6EF" },
  overdue: { label: "Quá hạn", color: "#C4302B", bg: "#FDECEC" },
  pending: { label: "Đang thực hiện", color: "#946200", bg: "#FBF0DD" },
};

const genId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const SEED_TASKS = [
  { id: genId(), group: "CHUC", task: "Soạn báo cáo tuần", ngayGiao: isoOffset(-6), ngayHoanThanhDuKien: isoOffset(-1), ngayHoanThanh: "" },
  { id: genId(), group: "CHUC", task: "Liên hệ khách hàng A", ngayGiao: isoOffset(-3), ngayHoanThanhDuKien: isoOffset(2), ngayHoanThanh: "" },
  { id: genId(), group: "CHUC", task: "Cập nhật hồ sơ nhân sự", ngayGiao: isoOffset(-12), ngayHoanThanhDuKien: isoOffset(-8), ngayHoanThanh: isoOffset(-8) },
  { id: genId(), group: "TUNG", task: "Kiểm kê kho tháng 8", ngayGiao: isoOffset(-8), ngayHoanThanhDuKien: isoOffset(-1), ngayHoanThanh: isoOffset(-1) },
  { id: genId(), group: "TUNG", task: "Sửa lỗi hệ thống đặt hàng", ngayGiao: isoOffset(-2), ngayHoanThanhDuKien: isoOffset(1), ngayHoanThanh: "" },
  { id: genId(), group: "TUNG", task: "Đào tạo nhân viên mới", ngayGiao: isoOffset(-15), ngayHoanThanhDuKien: isoOffset(-9), ngayHoanThanh: "" },
  { id: genId(), group: "TRUONG", task: "Lập kế hoạch marketing", ngayGiao: isoOffset(-5), ngayHoanThanhDuKien: isoOffset(4), ngayHoanThanh: "" },
  { id: genId(), group: "TRUONG", task: "Thiết kế banner sự kiện", ngayGiao: isoOffset(-7), ngayHoanThanhDuKien: isoOffset(-2), ngayHoanThanh: isoOffset(-2) },
];

const emptyForm = { group: "", task: "", ngayGiao: "", ngayHoanThanhDuKien: "", ngayHoanThanh: "" };
const emptyFilters = { ngayGiao: "", ngayHtdk: "", ngayHt: "" };

export default function App() {
  const [user, setUser] = useState(null);
  const [identityReady, setIdentityReady] = useState(false);

  useEffect(() => {
    const identity = initIdentity((u) => {
      setUser(u);
      setIdentityReady(true);
    });
    return () => {
      if (identity) {
        identity.off("init");
        identity.off("login");
        identity.off("logout");
      }
    };
  }, []);

  const roles = getRoles(user);
  const isSupervisor = roles.includes(SUPERVISOR_ROLE);
  const displayName = getDisplayName(user);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [usingDemoData, setUsingDemoData] = useState(false);
  const [activeGroup, setActiveGroup] = useState("ALL");
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [filters, setFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchTasks();
        if (cancelled) return;
        if (data.length === 0) {
          setTasks(SEED_TASKS);
          setUsingDemoData(true);
        } else {
          setTasks(data);
        }
      } catch (e) {
        if (cancelled) return;
        setLoadError(
          "Không kết nối được API /api/tasks. Nếu đang chạy 'npm run dev' ở local, hãy dùng " +
          "'netlify dev' thay thế, hoặc kiểm tra lại trên site đã deploy."
        );
        setTasks(SEED_TASKS);
        setUsingDemoData(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (activeGroup !== "ALL" && t.group !== activeGroup) return false;
        if (activeStatus === "incomplete") {
          if (getStatus(t) === "completed") return false;
        } else if (activeStatus !== "ALL" && getStatus(t) !== activeStatus) {
          return false;
        }
        if (filters.ngayGiao && t.ngayGiao !== filters.ngayGiao) return false;
        if (filters.ngayHtdk && t.ngayHoanThanhDuKien !== filters.ngayHtdk) return false;
        if (filters.ngayHt && t.ngayHoanThanh !== filters.ngayHt) return false;
        return true;
      })
      .sort((a, b) => {
        const aDone = getStatus(a) === "completed" ? 1 : 0;
        const bDone = getStatus(b) === "completed" ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return a.ngayGiao < b.ngayGiao ? 1 : -1;
      });
  }, [tasks, activeGroup, activeStatus, filters]);

  const groupScopedTasks = activeGroup === "ALL" ? tasks : tasks.filter((t) => t.group === activeGroup);
  const incompleteCount = groupScopedTasks.filter((t) => getStatus(t) !== "completed").length;
  const completedCount = groupScopedTasks.filter((t) => getStatus(t) === "completed").length;
  const overdueCount = groupScopedTasks.filter((t) => getStatus(t) === "overdue").length;

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };
  const openEditForm = (t) => {
    setEditingId(t.id);
    setForm({ group: t.group, task: t.task, ngayGiao: t.ngayGiao, ngayHoanThanhDuKien: t.ngayHoanThanhDuKien, ngayHoanThanh: t.ngayHoanThanh });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const saveForm = async () => {
    if (!form.group || !form.task.trim() || !form.ngayGiao || !form.ngayHoanThanhDuKien) return;
    const nextTasks = editingId
      ? tasks.map((t) => (t.id === editingId ? { ...t, ...form } : t))
      : [...tasks, { id: genId(), ...form }];

    setSaving(true);
    setSaveError("");
    try {
      const saved = await replaceTasks(nextTasks);
      setTasks(saved);
      setUsingDemoData(false);
      closeForm();
    } catch (e) {
      setSaveError(e.message || "Lưu công việc thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (id) => {
    const nextTasks = tasks.filter((t) => t.id !== id);
    setSaving(true);
    setSaveError("");
    try {
      const saved = await replaceTasks(nextTasks);
      setTasks(saved);
      setUsingDemoData(false);
    } catch (e) {
      setSaveError(e.message || "Xóa công việc thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const toggleComplete = async (t) => {
    const optimistic = tasks.map((x) => (x.id === t.id ? { ...x, ngayHoanThanh: x.ngayHoanThanh ? "" : todayIso() } : x));
    setTasks(optimistic);
    try {
      const saved = await toggleTaskComplete(t.id, todayIso());
      setTasks(saved);
      setUsingDemoData(false);
    } catch (e) {
      setTasks(tasks);
      setSaveError(e.message || "Cập nhật trạng thái thất bại.");
    }
  };

  const clearFilters = () => setFilters(emptyFilters);
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const workload = (groupKey) => {
    const gt = tasks.filter((t) => t.group === groupKey);
    const c = gt.filter((t) => getStatus(t) === "completed").length;
    const o = gt.filter((t) => getStatus(t) === "overdue").length;
    const p = gt.length - c - o;
    return { total: gt.length, c, o, p };
  };

  return (
    <div className="tpc-app">
      <style>{`
        .tpc-app {
          width: 100%;
          max-width: 100%;
          --navy: #16223F;
          --navy-2: #1F2F55;
          --blue: #2E5AAC;
          --ink: #101828;
          --muted: #667085;
          --border: #E4E7EC;
          --bg: #F3F5F9;
          --surface: #FFFFFF;
          --green: #12805C;
          --green-bg: #E7F6EF;
          --red: #C4302B;
          --red-bg: #FDECEC;
          --amber: #946200;
          --amber-bg: #FBF0DD;
          --gold: #D8B65A;
          --gold-bg: #FAF1DC;
          font-family: 'Inter', -apple-system, sans-serif;
          background: var(--bg);
          color: var(--ink);
          min-height: 100%;
          border-radius: 12px;
          overflow: hidden;
        }
        .tpc-app * { box-sizing: border-box; }
        .tpc-num { font-family: 'Sora', 'Inter', sans-serif; font-variant-numeric: tabular-nums; }

        .tpc-header {
          background: linear-gradient(135deg, var(--navy), var(--navy-2));
          padding: 22px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
        .tpc-title { color: #fff; font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
        .tpc-subtitle { color: #B8C2DA; font-size: 12px; margin-top: 3px; }
        .tpc-auth-box { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .tpc-badge {
          display: flex; align-items: center; gap: 7px; background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.22); padding: 7px 12px; border-radius: 10px;
          color: #fff; font-size: 12px; font-weight: 600;
        }
        .tpc-badge-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ADE80; }
        .tpc-btn-login {
          background: #fff; color: var(--navy); border: none; border-radius: 8px;
          padding: 9px 14px; font-size: 12px; font-weight: 700; cursor: pointer;
        }
        .tpc-btn-logout {
          background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.25);
          border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
        }

        .tpc-body { padding: 22px 28px 32px; }

        .tpc-banner {
          padding: 10px 14px; border-radius: 8px; font-size: 12.5px; margin-bottom: 14px;
        }
        .tpc-banner-info { background: var(--gold-bg); color: #7A5B12; }
        .tpc-banner-error { background: var(--red-bg); color: var(--red); font-weight: 600; }

        .tpc-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 11px; width: 100%; }
        .tpc-stat-card {
          width: 100%; min-width: 132px; min-height: 56px; border: none; border-radius: 10px; padding: 10px 14px; cursor: pointer;
          transition: transform .1s, box-shadow .15s; text-align: center; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 9px;
          border-left: 3px solid transparent;
        }
        .tpc-stat-card:hover { transform: translateY(-1px); }
        .tpc-stat-card.active { box-shadow: 0 0 0 3px rgba(16,24,40,0.18); }
        .tpc-stat-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.9; }
        .tpc-stat-value { font-size: 20px; font-weight: 700; margin-top: 2px; line-height: 1; }
        .tpc-stat-total { background: var(--gold); border-left: none; }
        .tpc-stat-total .tpc-stat-label, .tpc-stat-total .tpc-stat-value { color: #4A3A0E; }
        .tpc-stat-completed { background: var(--green); border-left: none; }
        .tpc-stat-completed .tpc-stat-label, .tpc-stat-completed .tpc-stat-value { color: #fff; }
        .tpc-stat-overdue { background: var(--red); border-left: none; }
        .tpc-stat-overdue .tpc-stat-label, .tpc-stat-overdue .tpc-stat-value { color: #fff; }

        .tpc-tabs { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
        .tpc-tab {
          flex: 1; background: var(--surface); border: 1.5px solid var(--border); border-radius: 10px;
          padding: 10px 14px; cursor: pointer; min-width: 132px; min-height: 56px; text-align: left;
        }
        .tpc-tab.active { border-color: var(--navy); background: #EEF1F8; }
        .tpc-tab-name { font-size: 12px; font-weight: 700; color: var(--ink); }
        .tpc-tab-count { font-size: 11px; color: var(--muted); margin-top: 1px; }
        .tpc-bar { height: 5px; border-radius: 3px; overflow: hidden; display: flex; margin-top: 8px; background: #EEF0F3; }
        .tpc-bar span { height: 100%; }

        .tpc-toolbar {
          background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px;
          padding: 14px 16px; margin-bottom: 16px; display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap;
        }
        .tpc-btn-filter-toggle {
          display: inline-flex; align-items: center; gap: 6px; background: #fff;
          border: 1.5px solid var(--border); border-radius: 8px; padding: 9px 13px;
          font-size: 12px; font-weight: 600; color: var(--ink); cursor: pointer;
        }
        .tpc-btn-filter-toggle:hover { background: #F5F6F8; }
        .tpc-filter-badge {
          background: var(--blue); color: #fff; font-size: 10px; font-weight: 700;
          min-width: 16px; height: 16px; border-radius: 999px; display: inline-flex;
          align-items: center; justify-content: center; padding: 0 4px;
        }
        .tpc-filter-caret { font-size: 9px; color: var(--muted); margin-left: 2px; }

        .tpc-filter-group { display: flex; flex-direction: column; gap: 5px; }
        .tpc-filter-group label { font-size: 11px; color: var(--muted); font-weight: 600; }
        .tpc-input, .tpc-select {
          border: 1.5px solid var(--border); border-radius: 7px; padding: 7px 9px; font-size: 12px;
          color: var(--ink); background: #fff; font-family: inherit;
        }
        .tpc-input:focus, .tpc-select:focus { outline: none; border-color: var(--blue); }
        .tpc-btn-clear {
          background: transparent; border: none; color: var(--blue); font-size: 12px; font-weight: 600;
          cursor: pointer; padding: 7px 4px; text-decoration: underline; text-underline-offset: 2px;
        }
        .tpc-spacer { flex: 1; }
        .tpc-btn-secondary {
          background: #fff; border: 1.5px solid var(--border); color: var(--ink); border-radius: 8px;
          padding: 9px 14px; font-size: 12px; font-weight: 600; cursor: pointer;
        }
        .tpc-btn-secondary:hover { background: #F5F6F8; }
        .tpc-btn-add {
          background: var(--navy); color: #fff; border: none; border-radius: 8px;
          padding: 10px 16px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;
        }
        .tpc-btn-add:hover { background: var(--navy-2); }

        .tpc-table-wrap { background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px; overflow: hidden; }
        table.tpc-table { width: 100%; border-collapse: collapse; }
        .tpc-table col.tpc-col-task { width: 100%; }
        .tpc-table th, .tpc-table td { white-space: nowrap; }
        .tpc-table th.tpc-col-task, .tpc-table td.tpc-col-task { white-space: normal; }
        .tpc-table thead th {
          text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em;
          color: var(--muted); font-weight: 700; padding: 10px 12px; border-bottom: 1.5px solid var(--border);
          background: #FAFBFC;
        }
        .tpc-table tbody td { padding: 10px 12px; font-size: 12.5px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .tpc-table tbody tr:last-child td { border-bottom: none; }
        .tpc-table tbody tr:hover { background: #FAFBFD; }
        .tpc-task-name { font-weight: 600; color: var(--ink); }
        .tpc-group-pill {
          display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px;
          background: #EEF1F8; color: var(--navy-2);
        }
        .tpc-status-pill {
          display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700;
          padding: 4px 10px; border-radius: 999px;
        }
        .tpc-status-dot { width: 6px; height: 6px; border-radius: 50%; }
        .tpc-done-cell { display: flex; align-items: center; gap: 8px; }
        .tpc-checkbox { width: 17px; height: 17px; accent-color: var(--green); cursor: pointer; flex-shrink: 0; }
        .tpc-actions { display: flex; gap: 6px; }
        .tpc-icon-btn {
          border: 1.5px solid var(--border); background: #fff; border-radius: 7px; width: 30px; height: 30px;
          display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 13px;
        }
        .tpc-icon-btn:hover { background: #F5F6F8; }
        .tpc-icon-btn.danger:hover { background: var(--red-bg); border-color: #F0B9B4; }
        .tpc-empty { padding: 46px 20px; text-align: center; color: var(--muted); font-size: 13.5px; }

        .tpc-modal-overlay {
          position: fixed; inset: 0; background: rgba(16,24,40,0.45); display: flex; align-items: center;
          justify-content: center; z-index: 50; padding: 20px;
        }
        .tpc-modal {
          background: #fff; border-radius: 14px; padding: 24px; width: 100%; max-width: 420px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        }
        .tpc-modal h3 { font-family: 'Sora', sans-serif; font-size: 17px; margin: 0 0 16px; color: var(--ink); }
        .tpc-form-row { display: flex; flex-direction: column; gap: 5px; margin-bottom: 13px; }
        .tpc-form-row label { font-size: 12px; font-weight: 600; color: var(--muted); }
        .tpc-form-row .tpc-input, .tpc-form-row .tpc-select { width: 100%; padding: 9px 10px; font-size: 13.5px; }
        .tpc-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
        .tpc-btn-secondary-modal {
          background: #fff; border: 1.5px solid var(--border); color: var(--ink); border-radius: 8px;
          padding: 9px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .tpc-btn-primary {
          background: var(--blue); border: none; color: #fff; border-radius: 8px;
          padding: 9px 16px; font-size: 13px; font-weight: 700; cursor: pointer;
        }

        @media (max-width: 720px) {
          .tpc-stats { grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px; }
          .tpc-stat-card {
            min-width: 0; min-height: 52px; padding: 8px 9px; border-radius: 8px;
            flex-direction: column; align-items: center; justify-content: center; border: none; text-align: center;
          }
          .tpc-stat-card:hover { transform: none; }
          .tpc-stat-card.active { box-shadow: 0 0 0 2px rgba(16,24,40,0.35); }
          .tpc-stat-label { font-size: 10px; }
          .tpc-stat-value { font-size: 20px; margin-top: 2px; }

          .tpc-tabs { flex-wrap: nowrap; gap: 5px; margin-bottom: 12px; overflow-x: auto; }
          .tpc-tab {
            flex: 1 1 0; min-width: 0; min-height: 40px; padding: 6px 6px; border: 1.5px solid var(--border); background: var(--surface);
          }
          .tpc-tab.active { border-color: var(--navy); background: #EEF1F8; }
          .tpc-tab-name { font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .tpc-tab-count { font-size: 8.5px; white-space: nowrap; }
          .tpc-bar { margin-top: 5px; }

          .tpc-body { padding: 14px; }
          .tpc-header {
            padding: 12px 14px; flex-direction: row; align-items: center; justify-content: space-between;
            flex-wrap: nowrap; gap: 8px;
          }
          .tpc-title { font-size: 14px; }
          .tpc-subtitle { font-size: 9.5px; }
          .tpc-header-titles { min-width: 0; flex: 1 1 auto; overflow: hidden; }
          .tpc-header-titles .tpc-title,
          .tpc-header-titles .tpc-subtitle { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .tpc-auth-box { width: auto; flex-shrink: 0; }
          .tpc-badge { padding: 5px 8px; font-size: 9px; gap: 5px; max-width: 110px; min-width: 0; }
          .tpc-badge-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
          .tpc-auth-box { flex-wrap: nowrap; min-width: 0; }
          .tpc-btn-login, .tpc-btn-logout { padding: 6px 10px; font-size: 10px; }
          .tpc-toolbar { flex-direction: column; align-items: stretch; padding: 10px 12px; gap: 6px; }
          .tpc-toolbar-toprow { display: flex; flex-direction: row; gap: 8px; width: 100%; }
          .tpc-toolbar-toprow .tpc-btn-filter-toggle,
          .tpc-toolbar-toprow .tpc-btn-secondary { flex: 1; width: auto; justify-content: center; padding: 8px 10px; }
          .tpc-filter-group { width: 100%; flex-direction: row; align-items: center; gap: 8px; }
          .tpc-filter-group label { width: 92px; flex-shrink: 0; }
          .tpc-filter-group .tpc-input { flex: 1; width: auto; padding: 5px 8px; }
          .tpc-btn-clear { align-self: flex-start; padding: 2px 4px; }
          .tpc-btn-add { width: 100%; padding: 8px 14px; }
          .tpc-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          table.tpc-table { min-width: 640px; }
          .tpc-table td.tpc-col-task, .tpc-table th.tpc-col-task { white-space: nowrap; min-width: auto; }
        }

        @media (max-width: 420px) {
          .tpc-stat-card { padding: 6px 7px; min-height: 48px; }
          .tpc-modal { padding: 18px; }
        }
      `}</style>

      <div className="tpc-header">
        <div className="tpc-header-titles">
          <div className="tpc-title">Bảng phân công công việc</div>
          <div className="tpc-subtitle">Theo dõi tiến độ theo nhóm phụ trách</div>
        </div>
        <div className="tpc-auth-box">
          {!identityReady ? null : user ? (
            <>
              <div className="tpc-badge">
                <span className="tpc-badge-dot" />
                <span className="tpc-badge-text">{displayName} {isSupervisor ? "— Giám sát" : "— Xem"}</span>
              </div>
              <button className="tpc-btn-logout" onClick={logout}>Đăng xuất</button>
            </>
          ) : (
            <button className="tpc-btn-login" onClick={openLogin}>Đăng nhập</button>
          )}
        </div>
      </div>

      <div className="tpc-body">
        {loading && <div className="tpc-banner tpc-banner-info">Đang tải dữ liệu…</div>}
        {!loading && loadError && <div className="tpc-banner tpc-banner-error">{loadError}</div>}
        {!loading && usingDemoData && !loadError && (
          <div className="tpc-banner tpc-banner-info">
            Đang hiển thị dữ liệu mẫu — sẽ được lưu thật ngay khi Giám sát thêm/sửa/xóa công việc đầu tiên.
          </div>
        )}
        {saveError && <div className="tpc-banner tpc-banner-error">{saveError}</div>}

        <div className="tpc-stats">
          <button
            className={`tpc-stat-card tpc-stat-total ${activeStatus === "incomplete" ? "active" : ""}`}
            onClick={() => setActiveStatus("incomplete")}
          >
            <div>
              <div className="tpc-stat-label">Công việc</div>
              <div className="tpc-stat-value tpc-num">{incompleteCount}</div>
            </div>
          </button>
          <button className={`tpc-stat-card tpc-stat-completed ${activeStatus === "completed" ? "active" : ""}`} onClick={() => setActiveStatus("completed")}>
            <div>
              <div className="tpc-stat-label">Hoàn thành</div>
              <div className="tpc-stat-value tpc-num">{completedCount}</div>
            </div>
          </button>
          <button className={`tpc-stat-card tpc-stat-overdue ${activeStatus === "overdue" ? "active" : ""}`} onClick={() => setActiveStatus("overdue")}>
            <div>
              <div className="tpc-stat-label">Quá hạn</div>
              <div className="tpc-stat-value tpc-num">{overdueCount}</div>
            </div>
          </button>
        </div>

        <div className="tpc-tabs">
          <button className={`tpc-tab ${activeGroup === "ALL" ? "active" : ""}`} onClick={() => setActiveGroup("ALL")}>
            <div className="tpc-tab-name">Tất cả nhóm</div>
            <div className="tpc-tab-count">
              {tasks.filter((t) => getStatus(t) !== "completed").length} công việc
            </div>
          </button>
          {GROUPS.map((g) => {
            const w = workload(g.key);
            return (
              <button key={g.key} className={`tpc-tab ${activeGroup === g.key ? "active" : ""}`} onClick={() => setActiveGroup(g.key)}>
                <div className="tpc-tab-name">{g.label}</div>
                <div className="tpc-tab-count">{w.o + w.p} công việc</div>
                {w.total > 0 && (
                  <div className="tpc-bar">
                    <span style={{ width: `${(w.c / w.total) * 100}%`, background: "var(--green)" }} />
                    <span style={{ width: `${(w.o / w.total) * 100}%`, background: "var(--red)" }} />
                    <span style={{ width: `${(w.p / w.total) * 100}%`, background: "#D8B65A" }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {(() => {
          const filterToggleBtn = (
            <button className="tpc-btn-filter-toggle" onClick={() => setShowFilters((v) => !v)}>
              ⚙ Bộ lọc {hasActiveFilters && <span className="tpc-filter-badge">{Object.values(filters).filter(Boolean).length}</span>}
              <span className="tpc-filter-caret">{showFilters ? "▲" : "▼"}</span>
            </button>
          );
          const csvBtn = (
            <button className="tpc-btn-secondary" onClick={() => exportTasksToCsv(filteredTasks, groupLabel, (t) => STATUS_META[getStatus(t)], formatDate)}>
              ⬇ Xuất CSV
            </button>
          );
          const filterFields = showFilters && (
            <>
              <div className="tpc-filter-group">
                <label>Ngày giao</label>
                <input type="date" className="tpc-input" value={filters.ngayGiao} onChange={(e) => setFilters((f) => ({ ...f, ngayGiao: e.target.value }))} />
              </div>
              <div className="tpc-filter-group">
                <label>Hạn hoàn thành</label>
                <input type="date" className="tpc-input" value={filters.ngayHtdk} onChange={(e) => setFilters((f) => ({ ...f, ngayHtdk: e.target.value }))} />
              </div>
              <div className="tpc-filter-group">
                <label>Ngày hoàn thành</label>
                <input type="date" className="tpc-input" value={filters.ngayHt} onChange={(e) => setFilters((f) => ({ ...f, ngayHt: e.target.value }))} />
              </div>
              {hasActiveFilters && <button className="tpc-btn-clear" onClick={clearFilters}>Xóa bộ lọc</button>}
            </>
          );
          const addBtn = isSupervisor && <button className="tpc-btn-add" onClick={openAddForm} disabled={saving}>+ Thêm công việc</button>;

          return (
            <div className="tpc-toolbar">
              {isMobile ? (
                <>
                  <div className="tpc-toolbar-toprow">{filterToggleBtn}{csvBtn}</div>
                  {filterFields}
                  {addBtn}
                </>
              ) : (
                <>
                  {filterToggleBtn}
                  {filterFields}
                  <div className="tpc-spacer" />
                  {csvBtn}
                  {addBtn}
                </>
              )}
            </div>
          );
        })()}

        <div className="tpc-table-wrap">
          {filteredTasks.length === 0 ? (
            <div className="tpc-empty">Không có công việc nào khớp với bộ lọc hiện tại.</div>
          ) : (
            <table className="tpc-table">
              <colgroup>
                <col className="tpc-col-task" />
                <col />
                <col />
                <col />
                <col />
                <col />
                {isSupervisor && <col />}
              </colgroup>
              <thead>
                <tr>
                  <th className="tpc-col-task">Công việc</th>
                  <th>Nhóm</th>
                  <th>Ngày giao</th>
                  <th>Hạn hoàn thành</th>
                  <th>Hoàn thành</th>
                  <th>Trạng thái</th>
                  {isSupervisor && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((t) => {
                  const st = getStatus(t);
                  const meta = STATUS_META[st];
                  return (
                    <tr key={t.id}>
                      <td className="tpc-task-name tpc-col-task">{t.task}</td>
                      <td><span className="tpc-group-pill">{groupLabel(t.group)}</span></td>
                      <td className="tpc-num">{formatDate(t.ngayGiao)}</td>
                      <td className="tpc-num">{formatDate(t.ngayHoanThanhDuKien)}</td>
                      <td>
                        <label className="tpc-done-cell">
                          <input type="checkbox" className="tpc-checkbox" checked={!!t.ngayHoanThanh} onChange={() => toggleComplete(t)} />
                          <span className="tpc-num">{formatDate(t.ngayHoanThanh)}</span>
                        </label>
                      </td>
                      <td>
                        <span className="tpc-status-pill" style={{ background: meta.bg, color: meta.color }}>
                          <span className="tpc-status-dot" style={{ background: meta.color }} />
                          {meta.label}
                        </span>
                      </td>
                      {isSupervisor && (
                        <td>
                          <div className="tpc-actions">
                            <button className="tpc-icon-btn" title="Sửa" onClick={() => openEditForm(t)} disabled={saving}>✎</button>
                            <button className="tpc-icon-btn danger" title="Xóa" onClick={() => deleteTask(t.id)} disabled={saving}>🗑</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && isSupervisor && (
        <div className="tpc-modal-overlay" onClick={closeForm}>
          <div className="tpc-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? "Sửa công việc" : "Thêm công việc"}</h3>

            <div className="tpc-form-row">
              <label>Nhóm phụ trách</label>
              <select className="tpc-select" value={form.group} onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}>
                <option value="">— Chọn nhóm —</option>
                {GROUPS.map((g) => (
                  <option key={g.key} value={g.key}>{g.label}</option>
                ))}
              </select>
            </div>

            <div className="tpc-form-row">
              <label>Công việc</label>
              <input className="tpc-input" placeholder="Nhập tên công việc" value={form.task} onChange={(e) => setForm((f) => ({ ...f, task: e.target.value }))} />
            </div>

            <div className="tpc-form-row">
              <label>Ngày giao</label>
              <input type="date" className="tpc-input" value={form.ngayGiao} onChange={(e) => setForm((f) => ({ ...f, ngayGiao: e.target.value }))} />
            </div>

            <div className="tpc-form-row">
              <label>Ngày hoàn thành dự kiến</label>
              <input type="date" className="tpc-input" value={form.ngayHoanThanhDuKien} onChange={(e) => setForm((f) => ({ ...f, ngayHoanThanhDuKien: e.target.value }))} />
            </div>

            <div className="tpc-form-row">
              <label>Ngày hoàn thành (để trống nếu chưa xong)</label>
              <input type="date" className="tpc-input" value={form.ngayHoanThanh} onChange={(e) => setForm((f) => ({ ...f, ngayHoanThanh: e.target.value }))} />
            </div>

            <div className="tpc-modal-actions">
              <button className="tpc-btn-secondary-modal" onClick={closeForm}>Hủy</button>
              <button className="tpc-btn-primary" onClick={saveForm} disabled={saving}>{saving ? "Đang lưu…" : "Lưu"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
