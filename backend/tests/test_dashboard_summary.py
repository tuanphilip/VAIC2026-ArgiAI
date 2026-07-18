from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.routes.dashboard import dashboard_summary


class FakeResult:
    def __init__(self, *, scalar=None, row=None, rows=None):
        self._scalar = scalar
        self._row = row
        self._rows = rows or []

    def scalar_one(self):
        return self._scalar

    def one(self):
        return self._row

    def all(self):
        return self._rows


class FakeSession:
    def __init__(self, results):
        self.results = iter(results)

    async def execute(self, _query):
        return next(self.results)


@pytest.mark.asyncio
async def test_dashboard_summary_returns_database_metrics_for_official():
    db = FakeSession(
        [
            FakeResult(scalar=7),
            FakeResult(row=(12, 42.75, 9, 3, 2, 51.4)),
            FakeResult(scalar=2),
            FakeResult(rows=[("Mường Ảng", 8, 31.25), ("Tuần Giáo", 4, 11.5)]),
            FakeResult(rows=[("Cà phê", "Arabica", 9, 35.0)]),
            FakeResult(rows=[("growing", 9), ("harvested", 3)]),
        ]
    )
    user = SimpleNamespace(id=uuid4(), role="official")

    result = await dashboard_summary(db=db, current_user=user)

    assert result.scope == "all"
    assert result.residents_count == 7
    assert result.plot_count == 12
    assert result.total_area_hectares == 42.75
    assert result.active_plot_count == 9
    assert result.active_disease_count == 2
    assert result.regions[0].region == "Mường Ảng"
    assert result.crops[0].crop_name == "Cà phê Arabica"


@pytest.mark.asyncio
async def test_dashboard_summary_scopes_farmer_to_one_user():
    db = FakeSession(
        [
            FakeResult(row=(2, 5.5, 1, 1, 1, 44.0)),
            FakeResult(scalar=0),
            FakeResult(rows=[]),
            FakeResult(rows=[]),
            FakeResult(rows=[("growing", 2)]),
        ]
    )
    user = SimpleNamespace(id=uuid4(), role="farmer")

    result = await dashboard_summary(db=db, current_user=user)

    assert result.scope == "own"
    assert result.residents_count == 1
    assert result.plot_count == 2
    assert result.average_moisture == 44.0
