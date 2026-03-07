import { describe, it, expect } from "vitest";
import {
  wrapInSlice,
  createNode,
  cloneWithNewIds,
  findNode,
  countNodes,
  validateTree,
} from "../lib/treeUtils";
import type { ComponentTreeNode } from "../types";

describe("createNode", () => {
  it("creates a node with auto-generated id", () => {
    const node = createNode("Hero", { heading: "Test" });
    expect(node.id).toBeTruthy();
    expect(node.type).toBe("Hero");
    expect(node.props).toEqual({ heading: "Test" });
    expect(node.children).toBeUndefined();
  });
});

describe("wrapInSlice", () => {
  it("wraps children in Section > Container", () => {
    const child = createNode("TextBlock", { text: "Hello" });
    const slice = wrapInSlice([child], { backgroundColor: "#000" }, { maxWidth: "800px" });

    expect(slice.type).toBe("Section");
    expect(slice.props).toEqual({ backgroundColor: "#000" });
    expect(slice.children).toHaveLength(1);
    expect(slice.children![0].type).toBe("Container");
    expect(slice.children![0].props).toEqual({ maxWidth: "800px" });
    expect(slice.children![0].children).toHaveLength(1);
    expect(slice.children![0].children![0]).toBe(child);
  });

  it("uses default props when none provided", () => {
    const slice = wrapInSlice([]);
    expect(slice.type).toBe("Section");
    expect(slice.props).toEqual({});
    expect(slice.children![0].type).toBe("Container");
    expect(slice.children![0].children).toEqual([]);
  });
});

describe("cloneWithNewIds", () => {
  it("deep-clones with new ids at every level", () => {
    const original: ComponentTreeNode[] = [
      {
        id: "a",
        type: "Section",
        props: {},
        children: [
          {
            id: "b",
            type: "Container",
            props: { maxWidth: "1200px" },
            children: [{ id: "c", type: "Hero", props: { heading: "Hi" } }],
          },
        ],
      },
    ];

    const cloned = cloneWithNewIds(original);

    // Structure preserved
    expect(cloned).toHaveLength(1);
    expect(cloned[0].type).toBe("Section");
    expect(cloned[0].children![0].type).toBe("Container");
    expect(cloned[0].children![0].children![0].type).toBe("Hero");

    // Ids regenerated
    expect(cloned[0].id).not.toBe("a");
    expect(cloned[0].children![0].id).not.toBe("b");
    expect(cloned[0].children![0].children![0].id).not.toBe("c");

    // Props preserved
    expect(cloned[0].children![0].props).toEqual({ maxWidth: "1200px" });
    expect(cloned[0].children![0].children![0].props).toEqual({ heading: "Hi" });

    // Original unchanged
    expect(original[0].id).toBe("a");
  });
});

describe("findNode", () => {
  const tree: ComponentTreeNode[] = [
    {
      id: "root",
      type: "Section",
      props: {},
      children: [
        {
          id: "container",
          type: "Container",
          props: {},
          children: [
            { id: "hero", type: "Hero", props: { heading: "Found" } },
          ],
        },
      ],
    },
  ];

  it("finds a node at the root level", () => {
    const result = findNode(tree, "root");
    expect(result?.type).toBe("Section");
  });

  it("finds a deeply nested node", () => {
    const result = findNode(tree, "hero");
    expect(result?.type).toBe("Hero");
    expect(result?.props.heading).toBe("Found");
  });

  it("returns undefined for non-existent id", () => {
    expect(findNode(tree, "nope")).toBeUndefined();
  });
});

describe("countNodes", () => {
  it("counts all nodes recursively", () => {
    const tree: ComponentTreeNode[] = [
      {
        id: "1",
        type: "Section",
        props: {},
        children: [
          {
            id: "2",
            type: "Container",
            props: {},
            children: [
              { id: "3", type: "Hero", props: {} },
              { id: "4", type: "Button", props: {} },
            ],
          },
        ],
      },
    ];
    expect(countNodes(tree)).toBe(4);
  });

  it("returns 0 for empty tree", () => {
    expect(countNodes([])).toBe(0);
  });
});

describe("validateTree", () => {
  it("accepts valid ComponentTreeNode[]", () => {
    expect(
      validateTree([
        { id: "1", type: "Hero", props: { heading: "Hi" } },
        {
          id: "2",
          type: "Section",
          props: {},
          children: [{ id: "3", type: "Container", props: {} }],
        },
      ]),
    ).toBe(true);
  });

  it("rejects non-array", () => {
    expect(validateTree({ id: "1", type: "Hero", props: {} })).toBe(false);
  });

  it("rejects nodes without id", () => {
    expect(validateTree([{ type: "Hero", props: {} }])).toBe(false);
  });

  it("rejects nodes without type", () => {
    expect(validateTree([{ id: "1", props: {} }])).toBe(false);
  });

  it("rejects nodes without props", () => {
    expect(validateTree([{ id: "1", type: "Hero" }])).toBe(false);
  });

  it("rejects nodes with invalid children", () => {
    expect(
      validateTree([
        {
          id: "1",
          type: "Section",
          props: {},
          children: [{ notAnId: "x" }],
        },
      ]),
    ).toBe(false);
  });

  it("accepts nodes with empty children array", () => {
    expect(
      validateTree([{ id: "1", type: "Section", props: {}, children: [] }]),
    ).toBe(true);
  });
});
