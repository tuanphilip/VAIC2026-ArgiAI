from app.routes.weather import _normalize_weather_payload


def test_normalize_weather_payload_exposes_hourly_and_daily_contract():
    result = _normalize_weather_payload(
        21.518,
        103.223,
        "Điện Biên",
        {
            "current_weather": {
                "time": "2026-07-18T10:00",
                "temperature": 28.4,
                "windspeed": 12.2,
                "winddirection": 180,
                "weathercode": 2,
            },
            "hourly": {
                "time": ["2026-07-18T10:00", "2026-07-18T11:00"],
                "relative_humidity_2m": [76, 74],
                "precipitation": [0, 0.4],
                "precipitation_probability": [10, 35],
                "temperature_2m": [28.4, 29.1],
                "windspeed_10m": [12.2, 13.0],
                "weathercode": [2, 61],
            },
        },
        {
            "daily": {
                "time": ["2026-07-18"],
                "temperature_2m_max": [30],
                "temperature_2m_min": [22],
                "precipitation_sum": [4.5],
                "precipitation_probability_max": [70],
                "windspeed_10m_max": [24],
                "weathercode": [61],
            }
        },
    )

    assert result.scope == "regional"
    assert result.location.label == "Điện Biên"
    assert result.current.temperature_c == 28.4
    assert result.current.weather_label == "Có mây"
    assert result.hourly[1].precipitation_probability_pct == 35
    assert result.daily[0].weather_label == "Mưa nhẹ"
