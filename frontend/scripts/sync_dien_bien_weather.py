#!/usr/bin/env python3
"""Synchronize source-backed Điện Biên weather snapshots.

No interpolation or synthetic values. Forecast and modeled historical rows remain
separate so downstream consumers cannot confuse them with field observations.
"""
from __future__ import annotations

import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

LATITUDE = 21.386
LONGITUDE = 103.016
TIMEZONE = "Asia/Bangkok"
ROOT = Path(__file__).resolve().parents[1] / "dataset" / "weather"
USER_AGENT = "ArgiAI-weather-sync/1.0"


def fetch_json(url: str) -> dict:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=60) as response:
        if response.status != 200:
            raise RuntimeError(f"source returned HTTP {response.status}: {url}")
        return json.load(response)


def open_meteo_url() -> str:
    return (
        "https://api.open-meteo.com/v1/forecast?"
        "latitude=21.386&longitude=103.016&"
        "current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m&"
        "daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,"
        "precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max&"
        "timezone=Asia%2FBangkok&forecast_days=7"
    )


def nasa_power_url() -> str:
    # Keep the complete 2025 modeled baseline reproducible. The UI labels it modeled,
    # never observed or realtime.
    return (
        "https://power.larc.nasa.gov/api/temporal/daily/point?"
        "parameters=PRECTOTCORR,T2M,T2M_MAX,T2M_MIN,RH2M&community=AG&"
        "longitude=103.016&latitude=21.386&start=20250101&end=20251231&format=JSON"
    )


def validate_forecast(data: dict) -> None:
    if data.get("timezone") != TIMEZONE:
        raise ValueError(f"unexpected timezone: {data.get('timezone')}")
    # Open-Meteo returns the nearest weather-model grid cell, not the exact
    # requested point. A small grid offset is expected; a province-scale jump
    # is not. Keep both requested and returned coordinates in metadata.
    if abs(float(data.get("latitude", 0)) - LATITUDE) > 0.1 or abs(float(data.get("longitude", 0)) - LONGITUDE) > 0.1:
        raise ValueError("source coordinates are outside the Điện Biên contract")
    current = data.get("current")
    daily = data.get("daily")
    required_current = {"time", "temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m"}
    required_daily = {"time", "temperature_2m_max", "temperature_2m_min", "precipitation_sum"}
    if not current or not required_current <= current.keys():
        raise ValueError("Open-Meteo current response is incomplete")
    if not daily or not required_daily <= daily.keys() or len(daily["time"]) != 7:
        raise ValueError("Open-Meteo daily response is incomplete or not 7 days")
    for field in ("temperature_2m_max", "temperature_2m_min", "precipitation_sum"):
        if any(value is None for value in daily[field]):
            raise ValueError(f"Open-Meteo contains null values in {field}")


def write_forecast(data: dict, source_url: str, crawl_date: str) -> None:
    daily = data["daily"]
    fields = [
        "observation_date", "latitude", "longitude", "temperature_max_c", "temperature_min_c",
        "precipitation_mm", "precipitation_probability_pct", "wind_max_kmh", "wind_gust_max_kmh",
        "source_name", "source_url", "publish_date", "license", "crawl_date", "verified",
        "data_type", "geographic_scope",
    ]
    rows = []
    for index, date in enumerate(daily["time"]):
        rows.append({
            "observation_date": date,
            "latitude": LATITUDE,
            "longitude": LONGITUDE,
            "temperature_max_c": daily["temperature_2m_max"][index],
            "temperature_min_c": daily["temperature_2m_min"][index],
            "precipitation_mm": daily["precipitation_sum"][index],
            "precipitation_probability_pct": daily.get("precipitation_probability_max", [None] * 7)[index],
            "wind_max_kmh": daily.get("wind_speed_10m_max", [None] * 7)[index],
            "wind_gust_max_kmh": daily.get("wind_gusts_10m_max", [None] * 7)[index],
            "source_name": "Open-Meteo Forecast API",
            "source_url": source_url,
            "publish_date": "MISSING",
            "license": "CC BY 4.0 / Open-Meteo attribution",
            "crawl_date": crawl_date,
            "verified": True,
            "data_type": "forecast",
            "geographic_scope": "Điện Biên, Việt Nam",
        })
    with (ROOT / "data.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def write_nasa(data: dict, source_url: str, crawl_date: str) -> int:
    parameters = data["properties"]["parameter"]
    fields = [
        "observation_date", "latitude", "longitude", "temperature_mean_c", "temperature_max_c",
        "temperature_min_c", "relative_humidity_pct", "precipitation_mm", "source_name", "source_url",
        "publish_date", "license", "crawl_date", "verified", "data_type", "geographic_scope",
    ]
    dates = sorted(parameters["T2M"].keys())
    rows = []
    for date in dates:
        values = {key: parameters[key].get(date) for key in ("T2M", "T2M_MAX", "T2M_MIN", "RH2M", "PRECTOTCORR")}
        if any(value == -999 or value is None for value in values.values()):
            continue
        rows.append({
            "observation_date": datetime.strptime(date, "%Y%m%d").date().isoformat(),
            "latitude": LATITUDE,
            "longitude": LONGITUDE,
            "temperature_mean_c": values["T2M"],
            "temperature_max_c": values["T2M_MAX"],
            "temperature_min_c": values["T2M_MIN"],
            "relative_humidity_pct": values["RH2M"],
            "precipitation_mm": values["PRECTOTCORR"],
            "source_name": "NASA POWER Daily API",
            "source_url": source_url,
            "publish_date": "MISSING",
            "license": "NASA Open Data",
            "crawl_date": crawl_date,
            "verified": True,
            "data_type": "modeled",
            "geographic_scope": "Điện Biên, Việt Nam",
        })
    with (ROOT / "historical_nasa_power.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def main() -> int:
    ROOT.mkdir(parents=True, exist_ok=True)
    crawl_date = datetime.now(timezone.utc).isoformat()
    forecast_url = open_meteo_url()
    nasa_url = nasa_power_url()
    forecast = fetch_json(forecast_url)
    validate_forecast(forecast)
    nasa = fetch_json(nasa_url)
    write_forecast(forecast, forecast_url, crawl_date)
    modeled_rows = write_nasa(nasa, nasa_url, crawl_date)
    (ROOT / "raw_response.json").write_text(json.dumps(forecast, ensure_ascii=False, indent=2), encoding="utf-8")
    (ROOT / "raw_nasa_power.json").write_text(json.dumps(nasa, ensure_ascii=False, indent=2), encoding="utf-8")
    metadata = {
        "dataset_id": "dien-bien-weather",
        "crawl_date": crawl_date,
        "geographic_scope": "Điện Biên, Việt Nam",
        "coordinates": {"requested": {"latitude": LATITUDE, "longitude": LONGITUDE}, "model_grid": {"latitude": forecast["latitude"], "longitude": forecast["longitude"]}},
        "sources": [
            {"name": "Open-Meteo Forecast API", "url": forecast_url, "data_type": "forecast", "records": len(forecast["daily"]["time"])},
            {"name": "NASA POWER Daily API", "url": nasa_url, "data_type": "modeled", "records": modeled_rows},
        ],
        "verification": {"coordinates_checked": True, "schema_checked": True, "nulls_dropped_from_nasa": True},
        "missing_fields": ["publish_date", "field_observation_id", "soil_moisture", "official_provincial_station_id"],
    }
    (ROOT / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": "ok", "forecast_records": 7, "nasa_modeled_records": modeled_rows, "crawl_date": crawl_date}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
