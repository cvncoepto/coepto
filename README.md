# Bảng phân công công việc — Vite + React + Netlify Identity

Ứng dụng quản lý phân công công việc theo nhóm (CHỨC / TÙNG / TRƯỜNG), có đăng nhập
thật qua **Netlify Identity** (hỗ trợ đăng nhập bằng Google), **phân quyền theo role**,
**lưu dữ liệu thật** qua Netlify Blobs, và **xuất file CSV**:

- **Giám sát** (role `giam_sat`): xem tất cả, thêm/sửa/xóa công việc cho mọi nhóm.
- **Người dùng khác** (đã đăng nhập hoặc chưa): chỉ xem và tick hoàn thành công việc.
- **Truy vết trách nhiệm**: khi mở app lần đầu, người xem (CHỨC/TÙNG/TRƯỜNG) phải bấm chọn đúng tên nhóm mình trên màn hình chào — sau đó chỉ thấy công việc của riêng nhóm đó (không xem được nhóm khác). Mọi lượt tick hoàn thành đều ghi lại rõ "hoàn thành bởi ai", hiển thị trong bảng và khi xuất CSV. Lựa chọn tên được lưu trên trình duyệt (localStorage), có thể bấm "Đổi người dùng" để chọn lại.
- **Dữ liệu lưu thật**: mọi thay đổi (thêm/sửa/xóa/tick hoàn thành) được lưu vào
  **Netlify Blobs** — tồn tại lâu dài, dùng chung cho mọi người truy cập site.
- **Xuất CSV**: nút "⬇ Xuất CSV" xuất đúng danh sách đang lọc/hiển thị ra `.csv`.
- **Bộ lọc ẩn mặc định**: bấm nút "⚙ Bộ lọc" để mở ra 3 ô lọc theo ngày.

> ⚠️ **Lưu ý kỹ thuật quan trọng**: `netlify/functions/tasks.js` dùng cú pháp Function
> **V1 (Lambda-style: `event`/`context`)**, KHÔNG dùng V2 (`Request`/`Response`).
> Lý do: chỉ V1 mới đọc được `context.clientContext.user` (thông tin đăng nhập +
> role từ Netlify Identity). Nếu sau này chỉnh sửa file này, giữ nguyên cú pháp
> `export const handler = async (event, context) => {...}` — đừng đổi sang
> `export default async (req, context) => {...}` kẻo mất quyền đọc role.

---

## 1. Cài đặt

```bash
npm install
```

## 2. Chạy thử local (cần Netlify CLI để API /api/tasks hoạt động)

```bash
npm install -g netlify-cli
netlify link      # liên kết thư mục này với site đã tạo trên Netlify (chạy 1 lần)
netlify dev
```

Lệnh `netlify dev` chạy Vite + Netlify Functions + Blobs cùng lúc tại
`http://localhost:8888`. Đăng nhập Google chỉ hoạt động đầy đủ khi đã deploy lên
Netlify hoặc chạy qua `netlify dev` đã link với site thật.

## 3. Build

```bash
npm run build
```

## 4. Deploy lên Netlify

**Qua Git (khuyên dùng):** đẩy code lên GitHub → Netlify → **Add new site** →
**Import an existing project** → chọn repo. Build command/publish directory đã có
sẵn trong `netlify.toml`.

**Qua CLI:**
```bash
netlify login
netlify init
netlify deploy --prod
```

## 5. Bật Netlify Identity

1. Site trên Netlify dashboard → **Project configuration → Identity → Enable Identity**.
2. (Khuyên dùng cho công cụ nội bộ) **Registration → Registration preferences** →
   chọn **Invite only**.

## 6. Bật đăng nhập Google

1. **Identity → Registration → External providers → Add provider → Google**.
2. Dùng shared keys của Netlify để test nhanh, hoặc tự tạo Google OAuth Client
   ID/Secret riêng tại [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   để hiện đúng tên app của bạn khi đăng nhập (không phải "Netlify Identity").
   - Nếu tự tạo Client ID/Secret riêng: nhớ khai báo **Authorized redirect URI**
     là `https://api.netlify.com/auth/done` trong Google Cloud Console, và thêm
     domain site của bạn vào **Authorized JavaScript origins**. Thiếu bước này là
     nguyên nhân phổ biến nhất khiến "Continue with Google" không hoạt động.

## 7. Mời người dùng (nếu chọn Invite only)

**Identity → Users → Invite users** → nhập email Gmail của Giám sát + CHỨC/TÙNG/TRƯỜNG.

## 8. Gán role "Giám sát"

1. Người dùng phải **đăng nhập vào app ít nhất 1 lần** trước để xuất hiện trong
   **Identity → Users**.
2. Chọn user đó → **Edit settings** → ô **Roles** → gõ `giam_sat` → lưu.
3. Người đó cần **đăng xuất và đăng nhập lại** (không chỉ tải lại trang) để JWT
   được cấp mới có chứa role vừa gán — role chỉ có hiệu lực từ lần đăng nhập tiếp
   theo.

## 9. Netlify Blobs (lưu dữ liệu thật) — không cần cấu hình gì thêm

Tự động kích hoạt cho mọi site trên Netlify. Function `tasks.js` tự tạo kho lưu trữ
`tasks-store` khi được gọi lần đầu.

- **GET** `/api/tasks` — đọc danh sách (công khai).
- **POST** `/api/tasks` — ghi đè toàn bộ danh sách (chỉ Giám sát).
- **PATCH** `/api/tasks` — tick/bỏ tick hoàn thành (mọi người dùng).

## 10. Cấu trúc dự án

```
netlify-task-app/
├── index.html
├── netlify.toml
├── package.json
├── vite.config.js
├── netlify/functions/tasks.js   # API — V1 Lambda-style (event, context)
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── identity.js
    ├── api.js
    └── exportCsv.js
```

## 11. Xử lý sự cố thường gặp

**"No user found with that email, or password invalid" khi đăng nhập:**
Đừng gõ email/password — bấm thẳng nút **"Continue with Google"**. Nếu vẫn không
vào được và Registration đang là Invite only, kiểm tra email đó đã được mời trong
**Identity → Users** chưa.

**Đăng nhập được nhưng vẫn báo "Chỉ Giám sát mới có quyền...":**
Đăng xuất hẳn rồi đăng nhập lại (không chỉ F5 tải lại trang) để lấy JWT mới có
chứa role. Nếu vẫn lỗi, kiểm tra `netlify/functions/tasks.js` có đang dùng đúng
cú pháp `export const handler = async (event, context) => {...}` (V1) hay không —
đây là lỗi hay gặp nhất khi function bị đổi nhầm sang cú pháp V2.

**"MissingBlobsEnvironmentError: The environment has not been configured to use
Netlify Blobs" khi chạy `netlify dev`:**
Vì function dùng cú pháp V1 ("Lambda compatibility mode"), Netlify Blobs không tự
nhận diện được môi trường — bắt buộc phải gọi `connectLambda(event)` trước
`getStore()`. Đây đã được sửa sẵn trong `tasks.js` phiên bản hiện tại; nếu lỗi này
xuất hiện lại, kiểm tra 2 dòng đầu file có đủ:
```js
import { getStore, connectLambda } from "@netlify/blobs";
// ...
export const handler = async (event, context) => {
  connectLambda(event);
  const store = getStore(STORE_NAME);
```
