# ArgiAI

ArgiAI là nền tảng quản lý nông nghiệp cho cán bộ địa phương và các hộ dân. Hệ thống tập trung vào quản lý hộ dân, thửa đất, cây trồng, bệnh cây, sản lượng, giá thị trường và thời tiết nông nghiệp theo khu vực.

## Chức năng chính

- **Dashboard**: diện tích, cơ cấu cây trồng, sản lượng dự báo, bệnh cây, giá thị trường và cảnh báo.
- **Hộ dân và người dùng**: định danh bằng UUID, username, họ tên, email, số điện thoại và CCCD. CCCD trong data demo là dữ liệu giả lập.
- **Thửa đất và cây trồng**: nhiều thửa theo hộ, khu vực, diện tích, mùa vụ, giống, trạng thái, sức khỏe, vật nuôi và dữ liệu cây trồng.
- **Tra cứu của cán bộ**: cán bộ có thể xem toàn bộ thửa đất; tìm theo mã thửa, hộ dân, username, CCCD, email, số điện thoại hoặc khu vực.
- **Bệnh cây**: ghi nhận bệnh, mức độ, độ tin cậy, hướng xử lý và trạng thái.
- **Giá thị trường**: lịch sử giá, cảnh báo ngưỡng và so sánh biến động.
- **Thời tiết chung**: dự báo và bản đồ radar theo phạm vi khu vực Tây Bắc. Tính năng này độc lập với thửa đất, hộ dân và cây trồng.
- **Cảnh báo thiên tai**: lớp cảnh báo chung trên bản đồ thời tiết.

> IoT, cảm biến, gateway và telemetry không thuộc phạm vi sản phẩm.

## Kiến trúc

```text
frontend/                 Next.js + TypeScript + Tailwind
    │
    ├── /api/v1/*          API client / Next rewrite
    │
backend/                  FastAPI + SQLAlchemy async
    │
    └── PostgreSQL         Supabase production database

weather: Open-Meteo + RainViewer/OpenWeather map layers
hosting: Vercel (frontend) + Coolify (backend) + Supabase (database)
```

## Cấu trúc thư mục

```text
backend/
  app/
    routes/               FastAPI routers
    models/               SQLAlchemy models
    schemas/              Pydantic request/response schemas
    services/             weather, disease, yield and market services
  tests/

database/migrations/      SQL migrations và seed data
frontend/src/
  app/                    Next.js App Router pages
  components/             UI components
  lib/                    API clients và tiện ích
```

## Yêu cầu môi trường

- Python 3.11+
- Node.js 20+
- PostgreSQL 15+ hoặc Supabase
- npm

Không commit credential. Các biến nhạy cảm chỉ đặt trong environment của backend/Coolify hoặc file local được Git ignore.

## Chạy backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# điền DATABASE_URL, JWT_SECRET_KEY và các biến cần thiết trong môi trường local
uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

API docs:

```text
http://localhost:8000/api/v1/docs
```

## Chạy frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend mặc định dùng `/api/v1`. Khi chạy tách backend, cấu hình `NEXT_PUBLIC_API_BASE_URL` phù hợp với môi trường local.

## Migration và data demo

Chạy migration theo thứ tự trong `database/migrations`:

```text
001_initial_schema.sql
002_seed_data.sql
003_add_plot_boundary_and_livestock.sql
004_add_crop_types_and_owner_phone.sql
005_add_plot_region.sql
006_add_disaster_warnings.sql
007_demo_seed_data.sql
008_add_user_identity_fields.sql
009_demo_households_and_user_identity.sql
010_expand_demo_plots_no_boundaries.sql
```

Các migration seed dùng `ON CONFLICT`, có thể chạy lại mà không nhân bản dữ liệu.

Data demo hiện gồm:

- 20 thửa đất
- 5 hộ dân có thông tin định danh
- nhiều khu vực: Điện Biên, Sơn La, Mộc Châu, Sa Pa, Yên Bái
- nhiều cây trồng, mùa vụ, trạng thái sinh trưởng và bệnh cây
- dữ liệu giá, yield forecast, market alert và disaster warning

`010_expand_demo_plots_no_boundaries.sql` cố ý để `plots.boundary = NULL`. Cán bộ hoặc người dùng sẽ khoanh vùng thủ công trên form quản lý thửa đất.

## API quan trọng

```text
GET  /api/v1/plots
GET  /api/v1/plots?search=<text>&region=<region>
POST /api/v1/plots
PUT  /api/v1/plots/{plot_id}

GET  /api/v1/users?search=<text>&role=farmer

GET  /api/v1/weather/overview
GET  /api/v1/weather/map-config
GET  /api/v1/weather/disasters
GET  /api/v1/weather/tiles/{layer}/{z}/{x}/{y}.png
```

Thời tiết không có các endpoint plot-scoped như `/weather/plots`, `/weather/current/{plot_code}` hoặc `/weather/forecast/{plot_code}`. Dự báo dùng một tọa độ trung tâm khu vực, không phụ thuộc số lượng thửa đất trong database.

## Phân quyền

- `farmer`: xem và quản lý dữ liệu thuộc mình; không được gán quyền sở hữu thửa đất cho user khác.
- `official`: xem toàn bộ thửa đất, cây trồng và tra cứu user trong phạm vi địa bàn.
- `admin`: quyền quản trị tương ứng với official và các chức năng quản trị hệ thống.

Backend luôn kiểm tra role ở route. Không dùng frontend để làm lớp bảo mật duy nhất.

## Kiểm thử và build

Backend:

```bash
cd backend
python -m pytest -q
python -m compileall -q app
```

Frontend:

```bash
cd frontend
npm run test:unit
npm run build
```

Trước khi push:

```bash
git diff --check
```

## Triển khai

- **Supabase**: chạy migration bằng SQL editor hoặc pipeline migration được kiểm soát.
- **Coolify**: deploy backend từ branch đã review, kiểm tra `/health` và API protected.
- **Vercel**: deploy frontend từ branch đã merge, kiểm tra login và dashboard bằng browser thật.

Không apply migration trực tiếp production nếu chưa kiểm tra transaction, foreign key, số lượng bản ghi và khả năng chạy lại an toàn.

## Quy tắc data demo

- Dùng UUID/username/CCCD/email làm định danh ổn định; không dùng họ tên làm khóa.
- Không đưa thông tin cá nhân thật vào seed.
- Không đưa password thật, token, API key hoặc connection string vào repository.
- Không tạo boundary tự động trong seed mới; boundary do người dùng khoanh trên giao diện.
- Không thêm IoT hoặc dữ liệu cảm biến vào demo.
