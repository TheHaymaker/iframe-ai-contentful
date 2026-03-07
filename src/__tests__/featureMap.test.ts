import { describe, it, expect } from "vitest";
import {
  featureMap,
  getFeatureEntry,
  containerTypes,
  leafTypes,
} from "../config/featureMap";

describe("featureMap", () => {
  it("contains Section and Container as containers", () => {
    expect(containerTypes).toContain("Section");
    expect(containerTypes).toContain("Container");
  });

  it("contains Hero, TextBlock, ImageCard, Button as leaf types", () => {
    expect(leafTypes).toContain("Hero");
    expect(leafTypes).toContain("TextBlock");
    expect(leafTypes).toContain("ImageCard");
    expect(leafTypes).toContain("Button");
  });

  it("has no overlap between container and leaf types", () => {
    const overlap = containerTypes.filter((t) => leafTypes.includes(t));
    expect(overlap).toEqual([]);
  });

  it("every entry has componentType, description, and propSchema", () => {
    for (const entry of featureMap) {
      expect(entry.componentType).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.propSchema).toBeDefined();
    }
  });

  it("Section only allows Container children", () => {
    const section = getFeatureEntry("Section");
    expect(section?.isContainer).toBe(true);
    expect(section?.allowedChildren).toEqual(["Container"]);
  });

  it("Container allows any children", () => {
    const container = getFeatureEntry("Container");
    expect(container?.isContainer).toBe(true);
    expect(container?.allowedChildren).toEqual([]);
  });
});

describe("getFeatureEntry", () => {
  it("returns entry for known type", () => {
    const hero = getFeatureEntry("Hero");
    expect(hero).toBeDefined();
    expect(hero?.componentType).toBe("Hero");
  });

  it("returns undefined for unknown type", () => {
    expect(getFeatureEntry("NonExistent")).toBeUndefined();
  });
});
