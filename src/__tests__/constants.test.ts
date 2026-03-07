import { describe, it, expect } from "vitest";
import { CHANNEL_NAME, MESSAGE_TYPES, generateSourceId } from "../constants";

describe("constants", () => {
  it("has channel name", () => {
    expect(CHANNEL_NAME).toBe("cms-hub");
  });

  it("has all message types", () => {
    expect(MESSAGE_TYPES.IFRAME_TREE_SNAPSHOT).toBe("IFRAME_TREE_SNAPSHOT");
    expect(MESSAGE_TYPES.IMPORT_TREE).toBe("IMPORT_TREE");
    expect(MESSAGE_TYPES.HUB_READY).toBe("HUB_READY");
    expect(MESSAGE_TYPES.IFRAME_ANNOUNCE).toBe("IFRAME_ANNOUNCE");
    expect(MESSAGE_TYPES.REQUEST_SNAPSHOT).toBe("REQUEST_SNAPSHOT");
    expect(MESSAGE_TYPES.GENERATE_RESULT).toBe("GENERATE_RESULT");
    expect(MESSAGE_TYPES.BROADCAST_TREE).toBe("BROADCAST_TREE");
  });

  it("generateSourceId produces unique UUIDs", () => {
    const id1 = generateSourceId();
    const id2 = generateSourceId();
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });
});
