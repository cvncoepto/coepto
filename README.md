# Bảng phân công công việc — Vite + React + Netlify Identity

Ứng dụng quản lý phân công công việc theo nhóm (CHỨC / TÙNG / TRƯỜNG).

## Tính năng chính

- **Giám sát** (role `giam_sat`, đăng nhập Google qua Netlify Identity): xem tất cả, thêm/sửa/xóa công việc, nhập/xuất CSV.
- **Người xem** (CHỨC/TÙNG/TRƯỜNG, không cần đăng nhập): chọn tên trên màn hình chào, chỉ thấy công việc nhóm mình, tick hoàn thành được.
- **Mô tả công việc**: bấm vào tên công việc trong bảng để mở/đóng xem mô tả chi tiết.
- **Truy vết**: mỗi lần tick hoàn thành ghi lại rõ "hoàn thành bởi ai".
- **Lưu dữ liệu thật** qua Netlify Blobs, **xuất/nhập CSV** để sao lưu.
- **Sắp xếp** theo Công việc / Hạn hoàn thành; công việc quá hạn luôn lên đầu; công việc đã hoàn thành thu gọn ở cuối bảng.
- Layout cố định: các thẻ phía trên đứng yên, chỉ bảng công việc cuộn riêng (cả 2 chiều, luôn hiện thanh cuộn).

> ⚠️ `netlify/functions/tasks.js` dùng cú pháp Function **V1** (`event`/`context`) —
> chỉ V1 mới đọc được `context.clientContext.user` (role Identity). Vì dùng V1
> ("Lambda compatibility mode"), bắt buộc gọi `connectLambda(event)` trước
> `getStore()`, nếu không sẽ lỗi `MissingBlobsEnvironmentError`.

## Chạy local

```bash
npm install
npm install -g netlify-cli   # nếu chưa có
netlify link                  # link với site đã tạo trên Netlify
netlify dev
```
Mở `http://localhost:8888` (không phải cổng Vite riêng lẻ).

## Deploy

Đẩy code lên GitHub → Netlify **Add new site → Import an existing project** → chọn repo.
Build command/publish directory đã có sẵn trong `netlify.toml`.

## Cấu hình Netlify Identity

1. **Project configuration → Identity → Enable Identity**.
2. **Registration → Registration preferences** → khuyên chọn **Invite only**.
3. **Registration → External providers → Add provider → Google** — dùng shared key để test nhanh, hoặc tự tạo Client ID/Secret riêng tại Google Cloud Console (nhớ khai báo đúng **Authorized redirect URI**: `https://identity.services.netlify.com/callback`, và **Authorized JavaScript origins**: domain site của bạn; OAuth consent screen phải chọn **External**, không phải Internal).
4. **Identity → Users → Invite users** (nếu Invite only) → mời email Giám sát.
5. Người đó đăng nhập lần đầu → **Identity → Users → chọn user → Edit settings → Roles → gõ `giam_sat`** → lưu → đăng xuất/đăng nhập lại để nhận role.

## Cấu trúc dự án

```
netlify-task-app/
├── index.html
├── netlify.toml
├── package.json
├── vite.config.js
├── netlify/functions/tasks.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── identity.js
    ├── api.js
    ├── exportCsv.js
    └── importCsv.js
```

## Xử lý sự cố thường gặp

**Đăng nhập Google báo `redirect_uri_mismatch`**: kiểm tra lại đúng URI
`https://identity.services.netlify.com/callback` trong Google Cloud Console.

**Báo `Error 403: org_internal`**: OAuth consent screen đang là "Internal" — cần
tạo lại project Google Cloud mới, chọn đúng "External" ngay từ đầu.

**Đăng nhập được nhưng vẫn báo "Chỉ Giám sát mới có quyền..."**: đăng xuất hẳn
rồi đăng nhập lại (không chỉ F5) để lấy JWT mới chứa role.

**`Signups not allowed for this instance`**: tài khoản không còn trong
Identity → Users (có thể đã bị xóa) — mời lại qua Invite users.

**Site bị 401 khi người ngoài team truy cập**: kiểm tra **Project configuration →
Project visibility**, chọn **Public** (không phải Private/team-only).
