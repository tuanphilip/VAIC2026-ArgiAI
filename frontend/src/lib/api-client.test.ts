import { describe, expect, it } from "vitest";

import { formatApiDetail } from "./api-error";

describe("api error formatting", () => {
  it("turns FastAPI validation objects into readable text", () => {
    expect(formatApiDetail([
      { loc: ["body", "crops", 0, "variety"], msg: "String should have at least 1 character" },
      { loc: ["body", "area_hectares"], msg: "Input should be greater than 0" },
    ])).toBe("crops.0.variety: String should have at least 1 character; area_hectares: Input should be greater than 0");
  });

  it("does not stringify objects as [object Object]", () => {
    expect(formatApiDetail([{ msg: "Owner not found" }])).toBe("Owner not found");
  });
});
