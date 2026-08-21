# Bảng phân công công việc — Vite + React + Netlify Identity

Ứng dụng quản lý phân công công việc theo nhóm (CHỨC / TÙNG / TRƯỜNG), có đăng nhập
thật qua **Netlify Identity** (hỗ trợ đăng nhập bằng Google), **phân quyền theo role**,
**lưu dữ liệu thật** qua Netlify Blobs, và **xuất file CSV**:

- **Giám sát** (role `giam_sat`): xem tất cả, thêm/sửa/xóa công việc cho mọi nhóm.
- **Người dùng khác** (đã đăng nhập hoặc chưa): chỉ xem và tick hoàn thành công việc.
- **Dữ liệu lưu thật**: mọi thay đổi (thêm/sửa/xóa/tick hoàn thành) được lưu vào
  **Netlify Blobs** — tồn tại lâu dài, dùng chung cho mọi người truy cập site, không
  mất khi tải lại trang.
- **Xuất CSV**: nút "⬇ Xuất CSV" trong thanh công cụ xuất đúng danh sách công việc
  đang được lọc/hiển thị ra file `.csv` (mở tốt bằng Excel, có dấu tiếng Việt).

---

## 1. Cài đặt

```bash
npm install
```

## 2. Chạy thử local (cần Netlify CLI để API /api/tasks hoạt động)

Chạy `npm run dev` (Vite thuần) sẽ **không** gọi được `/api/tasks` vì đó là Netlify
Function — cần Netlify CLI để giả lập môi trường Netlify đầy đủ (cả Functions lẫn
Blobs) ở local:

```bash
npm install -g netlify-cli
netlify link      # liên kết thư mục này với site đã tạo trên Netlify (chạy 1 lần)
netlify dev
```

Lệnh `netlify dev` sẽ tự chạy Vite + Netlify Functions + Blobs cùng lúc tại
`http://localhost:8888`.

> Nếu chỉ chạy `npm run dev`, app vẫn mở được nhưng sẽ hiện dữ liệu mẫu (demo) vì
> không gọi được API — đây là hành vi dự phòng có chủ đích, không phải lỗi.

Đăng nhập Netlify Identity (đặc biệt là nút Google) **chỉ hoạt động đầy đủ khi đã
deploy lên Netlify** hoặc chạy qua `netlify dev` đã link với site thật.

## 3. Build

```bash
npm run build
```

## 4. Deploy lên Netlify

**Cách A — qua Git (khuyên dùng):**
1. Đẩy toàn bộ thư mục này lên một repo GitHub/GitLab/Bitbucket.
2. Vào [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an
   existing project** → chọn repo vừa tạo.
3. Build command: `npm run build`, Publish directory: `dist` (đã cấu hình sẵn trong
   `netlify.toml`, Netlify tự nhận đúng).
4. Bấm **Deploy**.

**Cách B — qua Netlify CLI:**
```bash
netlify login
netlify init
netlify deploy --prod
```

## 5. Bật Netlify Identity

1. Vào site vừa deploy trên Netlify dashboard → **Site configuration** → **Identity**.
2. Bấm **Enable Identity**.
3. (Tùy chọn) Ở mục **Registration**, chọn **Invite only** nếu không muốn ai cũng tự
   đăng ký được — phù hợp với công cụ nội bộ như thế này.

## 6. Bật đăng nhập Google

1. Trong **Identity** → **Settings and usage** → mục **External providers**.
2. Bấm **Add provider** → chọn **Google**.
3. Dùng **shared keys** của Netlify để test nhanh, hoặc tự tạo **Google OAuth Client
   ID/Secret** riêng tại [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   để dùng production lâu dài.
4. Nút **"Log in with Google"** sẽ tự xuất hiện trong modal đăng nhập — không cần sửa
   code.

## 7. Gán role "Giám sát" cho tài khoản

Role không thể tự gán từ phía người dùng — admin phải gán thủ công:

1. Vào **Identity** → tab **Users** (người dùng cần đăng nhập ít nhất 1 lần trước để
   xuất hiện trong danh sách).
2. Bấm vào user đó → **Edit** → ô **Roles** → gõ `giam_sat` → lưu lại.
3. Người dùng đó cần **đăng xuất và đăng nhập lại** để nhận role mới.

## 8. Netlify Blobs (lưu dữ liệu thật) — không cần cấu hình gì thêm

Netlify Blobs được kích hoạt tự động cho mọi site đã deploy trên Netlify, Function
`netlify/functions/tasks.js` sẽ tự tạo kho lưu trữ `tasks-store` khi được gọi lần đầu.
Không cần tạo tài khoản dịch vụ ngoài, không cần API key.

- **GET** `/api/tasks` — đọc danh sách (công khai, không cần đăng nhập).
- **POST** `/api/tasks` — ghi đè toàn bộ danh sách (chỉ Giám sát, server kiểm tra role
  qua Netlify Identity JWT).
- **PATCH** `/api/tasks` — tick/bỏ tick hoàn thành một công việc (mọi người dùng).

## 9. Cấu trúc dự án

```
netlify-task-app/
├── index.html                       # HTML gốc, nạp Netlify Identity widget qua CDN
├── netlify.toml                      # Build config + route /api/tasks + SPA fallback
├── package.json
├── vite.config.js
├── netlify/
│   └── functions/
│       └── tasks.js                  # API đọc/ghi công việc qua Netlify Blobs
└── src/
    ├── main.jsx                      # Entry point React
    ├── App.jsx                       # Toàn bộ giao diện + logic ứng dụng
    ├── identity.js                   # Wrapper cho window.netlifyIdentity
    ├── api.js                        # Gọi /api/tasks kèm JWT xác thực
    └── exportCsv.js                  # Xuất danh sách công việc ra .csv
```

## 10. Nâng cấp thêm (tùy chọn, báo lại nếu cần)

- **Lịch sử thay đổi / audit log** — ghi lại ai sửa gì, khi nào.
- **Thông báo** (email/Slack) khi có công việc quá hạn.
- **Chuyển sang Supabase/FaunaDB** nếu cần truy vấn phức tạp hơn hoặc realtime
  đồng bộ nhiều tab cùng lúc (Blobs phù hợp cho quy mô nhỏ-vừa, không có realtime
  push tự động — người dùng cần tải lại trang để thấy thay đổi của người khác).
