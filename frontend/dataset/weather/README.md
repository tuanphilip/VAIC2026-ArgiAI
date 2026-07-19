# thời tiết điện biên

Bộ dữ liệu được đồng bộ bằng `npm run sync:weather`. Pipeline tải và kiểm tra hai lớp dữ liệu, không trộn chúng:

- `data.csv`: forecast 7 ngày từ Open-Meteo.
- `historical_nasa_power.csv`: 365 ngày dữ liệu modeled năm 2025 từ NASA POWER.
- `data.xlsx`: bản Excel của forecast snapshot.
- `raw_response.json`: phản hồi forecast gốc.
- `raw_nasa_power.json`: phản hồi NASA POWER gốc.
- `schema.json`: schema record forecast.
- `metadata.json`: provenance, tọa độ yêu cầu và ô lưới model trả về.

## nguồn và phạm vi

- Open-Meteo Forecast API: https://api.open-meteo.com/v1/forecast
- NASA POWER Daily API: https://power.larc.nasa.gov/api/temporal/daily/point
- tọa độ yêu cầu: `21.386, 103.016`, Điện Biên, Việt Nam
- timezone: `Asia/Bangkok`

Open-Meteo trả về ô lưới model gần nhất, không phải điểm đo chính xác. Pipeline cho phép sai lệch tối đa 0.1 độ và lưu cả hai tọa độ trong `metadata.json`.

## phân loại dữ liệu

- `forecast`: dự báo/model output ngắn hạn, dùng cho biểu đồ và cảnh báo.
- `modeled`: dữ liệu NASA POWER/MERRA-2, dùng làm baseline lịch sử.
- `observation`: MISSING — chưa có trạm quan trắc/field observation chính thức được kết nối.

Không dùng dữ liệu modeled hoặc forecast để tuyên bố là số đo tại ruộng.

## trường còn thiếu

- `publish_date`: MISSING vì các API không cung cấp ngày xuất bản theo bản ghi.
- `field_observation_id`: MISSING.
- `soil_moisture`: MISSING trong pipeline hiện tại.
- `official_provincial_station_id`: MISSING.
