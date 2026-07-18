import { describe, expect, it } from "vitest";

import {
  buildDisasterAlertItems,
  buildDisasterOverlayFeatures,
  getDisasterSeverityMeta,
  parseAffectedRegion,
} from "./disaster-warnings";

describe("parseAffectedRegion", () => {
  it("parses a polygon geojson string", () => {
    expect(
      parseAffectedRegion(
        JSON.stringify({
          type: "Polygon",
          coordinates: [
            [
              [105.8, 21.02],
              [105.85, 21.02],
              [105.85, 21.06],
              [105.8, 21.06],
              [105.8, 21.02],
            ],
          ],
        }),
      ),
    ).toEqual({
      type: "Polygon",
      coordinates: [
        [
          [105.8, 21.02],
          [105.85, 21.02],
          [105.85, 21.06],
          [105.8, 21.06],
          [105.8, 21.02],
        ],
      ],
    });
  });

  it("returns null for invalid json", () => {
    expect(parseAffectedRegion("not-json")).toBeNull();
  });
});

describe("buildDisasterOverlayFeatures", () => {
  it("converts point warnings into polygon overlays with popup content", () => {
    const features = buildDisasterOverlayFeatures([
      {
        id: "dw-1",
        type: "flood",
        severity: "critical",
        title: "Cảnh báo lũ lớn",
        description: "Nguy cơ ngập úng diện rộng",
        affected_region: JSON.stringify({ type: "Point", coordinates: [105.8, 21.02] }),
        start_date: "2026-07-19T00:00:00+00:00",
        end_date: "2026-07-20T00:00:00+00:00",
        source: "Open-Meteo",
        raw_data: "{}",
      },
    ]);

    expect(features).toHaveLength(1);
    expect(features[0].geometry.type).toBe("Polygon");
    expect(features[0].popup.windowLabel).toContain("19/07");
    expect(features[0].severity.level).toBe("critical");
  });

  it("keeps polygon warnings as polygons", () => {
    const features = buildDisasterOverlayFeatures([
      {
        id: "dw-2",
        type: "storm",
        severity: "high",
        title: "Cảnh báo bão",
        description: "Gió mạnh",
        affected_region: JSON.stringify({
          type: "Polygon",
          coordinates: [
            [
              [106.0, 10.7],
              [106.1, 10.7],
              [106.1, 10.8],
              [106.0, 10.8],
              [106.0, 10.7],
            ],
          ],
        }),
        start_date: "2026-07-19T00:00:00+00:00",
        end_date: null,
        source: "GFMS",
        raw_data: "{}",
      },
    ]);

    expect(features[0].geometry.coordinates[0][1]).toEqual([106.1, 10.7]);
  });
});

describe("buildDisasterAlertItems", () => {
  it("sorts high-severity disasters first and maps metadata for the alerts tab", () => {
    const alerts = buildDisasterAlertItems([
      {
        id: "dw-medium",
        type: "drought",
        severity: "medium",
        title: "Hạn cục bộ",
        description: "Thiếu mưa kéo dài",
        affected_region: JSON.stringify({ type: "Point", coordinates: [105.8, 21.02] }),
        start_date: "2026-07-21T00:00:00+00:00",
        end_date: null,
        source: "Open-Meteo",
        raw_data: "{}",
      },
      {
        id: "dw-critical",
        type: "flood",
        severity: "critical",
        title: "Lũ quét",
        description: "Mưa cực lớn",
        affected_region: JSON.stringify({ type: "Point", coordinates: [105.9, 21.01] }),
        start_date: "2026-07-19T00:00:00+00:00",
        end_date: "2026-07-20T00:00:00+00:00",
        source: "GFMS",
        raw_data: "{}",
      },
    ]);

    expect(alerts[0]).toMatchObject({
      id: "dw-critical",
      level: "high",
      title: "Lũ quét",
    });
    expect(alerts[0].trigger).toContain("GFMS");
    expect(alerts[1].level).toBe("medium");
  });
});

describe("getDisasterSeverityMeta", () => {
  it("maps critical severity to a high-priority ui badge", () => {
    expect(getDisasterSeverityMeta("critical")).toMatchObject({
      level: "critical",
      uiLevel: "high",
      label: "Khẩn cấp",
    });
  });
});
