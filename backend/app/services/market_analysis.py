from app.models import MarketPrice


def moving_average(values: list[float], window: int) -> float | None:
    if len(values) < window:
        return None
    return sum(values[-window:]) / window


def build_market_recommendation(prices: list[MarketPrice]) -> str:
    if len(prices) < 2:
        return "Chưa đủ dữ liệu lịch sử để phân tích xu hướng. Nên tiếp tục cập nhật giá hằng ngày."

    ordered = sorted(prices, key=lambda item: item.recorded_date)
    values = [item.price_per_kg for item in ordered]
    latest = values[-1]
    previous = values[-2]
    roc = ((latest - previous) / previous * 100) if previous else 0
    sma7 = moving_average(values, 7)
    sma30 = moving_average(values, 30)

    if sma7 and sma30 and sma7 > sma30 and roc > 0:
        return (
            f"SMA-7 đang cao hơn SMA-30, giá tăng {roc:.2f}% so với phiên trước. "
            "Khuyến nghị giữ hàng hoặc chốt một phần khi đạt giá mục tiêu."
        )
    if roc > 1:
        return f"Giá tăng nhanh {roc:.2f}% so với phiên trước. Nên theo dõi thêm nguồn cung trước khi bán số lượng lớn."
    if roc < -1:
        return f"Giá giảm {abs(roc):.2f}% so với phiên trước. Khuyến nghị thận trọng và ưu tiên hợp đồng bao tiêu."
    return "Giá biến động nhẹ, xu hướng ngắn hạn tương đối ổn định."
