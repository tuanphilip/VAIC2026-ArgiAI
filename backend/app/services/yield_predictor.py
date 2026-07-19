from datetime import timedelta

from app.models import Plot


def predict_yield(plot: Plot) -> tuple[float, float, object, object, str]:
    crop_name = plot.crop.name.lower()
    base_yield_per_ha = 3.8
    base_temp = 10
    if "cà phê" in crop_name:
        base_yield_per_ha = 2.6
        base_temp = 12
    elif "rau" in crop_name:
        base_yield_per_ha = 18.0
        base_temp = 8

    health_factor = 0.88 if plot.status == "disease_outbreak" else 1.0
    moisture_factor = 1.0
    if plot.moisture is not None:
        moisture_factor = max(0.75, min(1.08, 1 - abs(plot.moisture - 60) / 200))

    forecasted_yield = round(plot.area_hectares * base_yield_per_ha * health_factor * moisture_factor, 2)
    harvest_start = plot.seeding_date + timedelta(days=max(plot.crop.growth_duration_days - 7, 1))
    harvest_end = harvest_start + timedelta(days=7)
    confidence = 0.5
    advisory = (
        "[HEURISTIC - CHƯA PHẢI MÔ HÌNH ML] "
        f"Dự báo dựa trên chu kỳ {plot.crop.growth_duration_days} ngày và ngưỡng GDD nền {base_temp}°C. "
        "Nên theo dõi thời tiết trong tuần thu hoạch để giảm rủi ro mưa ẩm."
    )
    return forecasted_yield, confidence, harvest_start, harvest_end, advisory
