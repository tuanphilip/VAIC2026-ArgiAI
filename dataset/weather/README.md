# thời tiết điện biên

Dữ liệu 7 ngày từ Open-Meteo Forecast API tại tọa độ 21.386, 103.016 (Asia/Bangkok). Dùng cho trực quan hóa và tính toán chỉ số dự báo. Không được gọi là số đo thực địa.

- `data.csv`: dữ liệu đã chuẩn hóa.
- `raw_response.json`: snapshot phản hồi gốc.
- `schema.json`: schema record.
- `metadata.json`: provenance và các trường thiếu.
- `data.xlsx`: MISSING — chưa sinh vì môi trường không có thư viện Excel; CSV là định dạng phục vụ ingest.

## nguồn

- Open-Meteo: https://api.open-meteo.com/v1/forecast
- Giấy phép/attribution: CC BY 4.0 / Open-Meteo attribution
- Thời điểm lấy: xem `metadata.json`.

## giới hạn

- Dữ liệu là forecast/model output, không phải quan trắc tại ruộng.
- `publish_date`: MISSING vì API không cung cấp ngày xuất bản.
- độ ẩm đất và đất: MISSING trong snapshot này.
