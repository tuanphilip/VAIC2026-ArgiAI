from pathlib import Path


def test_weather_routes_do_not_contain_plot_scoped_endpoints() -> None:
    source = Path("app/routes/weather.py").read_text(encoding="utf-8")

    assert 'router.get("/plots")' not in source
    assert 'router.get("/current/{plot_code}")' not in source
    assert 'router.get("/forecast/{plot_code}")' not in source
    assert 'router.get("/overview")' in source
