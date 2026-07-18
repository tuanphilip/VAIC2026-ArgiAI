"""Geographic guardrails for ArgiAI's Vietnam agricultural scope."""

# Vietnam bounding box. User-facing defaults and seeded data are Điện Biên;
# this guard prevents arbitrary foreign coordinates entering the API.
VIETNAM_LAT_MIN = 8.18
VIETNAM_LAT_MAX = 23.39
VIETNAM_LON_MIN = 102.14
VIETNAM_LON_MAX = 109.46


def is_vietnam_coordinate(lat: float, lon: float) -> bool:
    return VIETNAM_LAT_MIN <= lat <= VIETNAM_LAT_MAX and VIETNAM_LON_MIN <= lon <= VIETNAM_LON_MAX


def dien_bien_region_filter(column):
    return column.ilike("%Điện Biên%")
