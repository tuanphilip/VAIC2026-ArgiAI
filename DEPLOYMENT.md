# Hướng dẫn deploy production ArgiAI

Kiến trúc đề xuất:

- Database + Storage: Supabase
- Backend API: FastAPI chạy bằng Docker trên Coolify
- Frontend: Next.js chạy trên Vercel

## 1. Chuẩn bị Supabase

1. Tạo project Supabase mới.
2. Vào SQL Editor và chạy lần lượt:
   - `database/migrations/001_initial_schema.sql`
   - `database/migrations/002_seed_data.sql`
3. Vào Storage, tạo bucket:
   - Name: `disease-images`
   - Public bucket: bật nếu frontend cần xem ảnh trực tiếp bằng public URL.
4. Lấy các thông tin sau:
   - `DATABASE_URL`: dùng Transaction pooler connection string.
   - `SUPABASE_URL`: URL project, dạng `https://PROJECT_REF.supabase.co`.
   - `SUPABASE_SERVICE_ROLE_KEY`: service role key, chỉ đặt ở backend/Coolify.

Lưu ý: không đưa `SUPABASE_SERVICE_ROLE_KEY` lên frontend hoặc Vercel.

## 2. Deploy backend trên Coolify

Tạo resource mới từ Git repository, chọn Dockerfile:

- Build context: `backend`
- Dockerfile: `backend/Dockerfile`
- Exposed port: `8000`
- Health check path: `/health`

Biến môi trường backend:

```env
APP_NAME=ArgiAI API
ENVIRONMENT=production
API_V1_PREFIX=/api/v1
BACKEND_CORS_ORIGINS=["https://your-frontend.vercel.app"]
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
JWT_SECRET_KEY=replace-with-a-64-character-random-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key
SUPABASE_STORAGE_BUCKET=disease-images
UPLOAD_DIR=uploads
```

Sau khi deploy, kiểm tra:

```bash
curl https://your-backend.example.com/health
```

Swagger/OpenAPI:

```text
https://your-backend.example.com/api/v1/docs
```

## 3. Deploy frontend trên Vercel

Tạo project Vercel từ repo:

- Root Directory: `frontend`
- Install command: `npm ci`
- Build command: `npm run build`
- Output: Next.js mặc định

Biến môi trường frontend:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com/api/v1
```

Sau khi Vercel có domain production, quay lại Coolify cập nhật:

```env
BACKEND_CORS_ORIGINS=["https://your-frontend.vercel.app"]
```

Nếu cần test cả local:

```env
BACKEND_CORS_ORIGINS=["https://your-frontend.vercel.app","http://localhost:4000"]
```

## 4. Chạy local

Backend:

```bash
cd backend
copy .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev -- -p 4000
```

API local:

```text
http://localhost:8000/api/v1/docs
```

Frontend local:

```text
http://localhost:4000
```

## 5. Endpoint chính

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/plots`
- `POST /api/v1/plots`
- `PUT /api/v1/plots/{id}`
- `DELETE /api/v1/plots/{id}`
- `POST /api/v1/diseases/detect`
- `PUT /api/v1/diseases/logs/{id}/status`
- `POST /api/v1/yield/predict`
- `GET /api/v1/market/prices`
- `POST /api/v1/market/prices`
- `DELETE /api/v1/market/prices/{id}`
- `POST /api/v1/market/alerts`
- `GET /api/v1/dashboard/compare`

## 6. Ghi chú production

- Backend đang có AI detector dạng rule-based/stub để API chạy ổn trong production. Khi có model thật, thay logic trong `backend/app/services/disease_detector.py`.
- Supabase RLS đã bật. Backend dùng service role key nên bypass RLS. Nếu frontend đọc trực tiếp Supabase sau này, cần bổ sung policy chi tiết theo user.
- Nên xoay `JWT_SECRET_KEY` riêng cho production và không commit file `.env`.
