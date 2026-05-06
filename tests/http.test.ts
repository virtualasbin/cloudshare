import { describe, expect, it } from "vitest";
import { createAssetSchema, normalizePath, updateAssetSchema } from "../src/lib/http.js";

describe("normalizePath", () => {
  it("returns path segments without empty values", () => {
    expect(normalizePath("/assets/123/")).toEqual(["assets", "123"]);
  });
});

describe("createAssetSchema", () => {
  it("validates create payload", () => {
    const parsed = createAssetSchema.parse({
      name: "photo.png",
      contentType: "image/png",
      fileBase64: "YWJj",
      tags: ["summer"]
    });
    expect(parsed.name).toBe("photo.png");
    expect(parsed.tags).toEqual(["summer"]);
  });

  it("defaults tags to an empty array", () => {
    const parsed = createAssetSchema.parse({
      name: "photo.png",
      contentType: "image/png",
      fileBase64: "YWJj"
    });
    expect(parsed.tags).toEqual([]);
  });
});

describe("updateAssetSchema", () => {
  it("accepts partial payload", () => {
    const parsed = updateAssetSchema.parse({
      name: "new-name.png"
    });
    expect(parsed.name).toBe("new-name.png");
  });

  it("rejects empty strings", () => {
    expect(() =>
      updateAssetSchema.parse({
        name: ""
      })
    ).toThrow();
  });
});
