import { describe, it, expect, beforeEach } from "vitest";
import { useTreeStore } from "../store/treeStore";

describe("treeStore", () => {
  beforeEach(() => {
    // Reset store between tests
    useTreeStore.setState({
      nodes: [],
      selectedNodeId: null,
    });
  });

  it("starts with empty nodes and no selection", () => {
    const state = useTreeStore.getState();
    expect(state.nodes).toEqual([]);
    expect(state.selectedNodeId).toBeNull();
  });

  it("addSlice creates a Section > Container > component structure", () => {
    useTreeStore.getState().addSlice("Hero", { heading: "Test" });
    const { nodes } = useTreeStore.getState();

    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("Section");
    expect(nodes[0].children).toHaveLength(1);
    expect(nodes[0].children![0].type).toBe("Container");
    expect(nodes[0].children![0].children).toHaveLength(1);
    expect(nodes[0].children![0].children![0].type).toBe("Hero");
    expect(nodes[0].children![0].children![0].props).toEqual({ heading: "Test" });
  });

  it("addSlice adds multiple slices", () => {
    const store = useTreeStore.getState();
    store.addSlice("Hero", { heading: "First" });
    store.addSlice("TextBlock", { text: "Second" });
    const { nodes } = useTreeStore.getState();

    expect(nodes).toHaveLength(2);
    expect(nodes[0].children![0].children![0].type).toBe("Hero");
    expect(nodes[1].children![0].children![0].type).toBe("TextBlock");
  });

  it("selectNode sets selectedNodeId", () => {
    useTreeStore.getState().addSlice("Hero", { heading: "x" });
    const heroId = useTreeStore.getState().nodes[0].children![0].children![0].id;

    useTreeStore.getState().selectNode(heroId);
    expect(useTreeStore.getState().selectedNodeId).toBe(heroId);
  });

  it("selectNode with null clears selection", () => {
    useTreeStore.getState().selectNode("something");
    useTreeStore.getState().selectNode(null);
    expect(useTreeStore.getState().selectedNodeId).toBeNull();
  });

  it("updateNodeProps merges props on a nested node", () => {
    useTreeStore.getState().addSlice("Hero", { heading: "Old", textColor: "#fff" });
    const heroId = useTreeStore.getState().nodes[0].children![0].children![0].id;

    useTreeStore.getState().updateNodeProps(heroId, { heading: "New", ctaText: "Click" });

    const hero = useTreeStore.getState().nodes[0].children![0].children![0];
    expect(hero.props).toEqual({
      heading: "New",
      textColor: "#fff",
      ctaText: "Click",
    });
  });

  it("removeNode removes a nested node", () => {
    useTreeStore.getState().addSlice("Hero", { heading: "x" });
    const heroId = useTreeStore.getState().nodes[0].children![0].children![0].id;

    useTreeStore.getState().removeNode(heroId);
    const container = useTreeStore.getState().nodes[0].children![0];
    expect(container.children).toEqual([]);
  });

  it("removeNode clears selection if removed node was selected", () => {
    useTreeStore.getState().addSlice("Hero", { heading: "x" });
    const heroId = useTreeStore.getState().nodes[0].children![0].children![0].id;

    useTreeStore.getState().selectNode(heroId);
    useTreeStore.getState().removeNode(heroId);
    expect(useTreeStore.getState().selectedNodeId).toBeNull();
  });

  it("removeNode preserves selection if different node removed", () => {
    useTreeStore.getState().addSlice("Hero", { heading: "x" });
    useTreeStore.getState().addSlice("Button", { label: "y" });

    const heroId = useTreeStore.getState().nodes[0].children![0].children![0].id;
    const buttonId = useTreeStore.getState().nodes[1].children![0].children![0].id;

    useTreeStore.getState().selectNode(heroId);
    useTreeStore.getState().removeNode(buttonId);
    expect(useTreeStore.getState().selectedNodeId).toBe(heroId);
  });

  it("addNodeToContainer adds a child at the end", () => {
    useTreeStore.getState().addSlice("Hero", { heading: "x" });
    const containerId = useTreeStore.getState().nodes[0].children![0].id;

    useTreeStore.getState().addNodeToContainer(containerId, "Button", { label: "Click" });

    const container = useTreeStore.getState().nodes[0].children![0];
    expect(container.children).toHaveLength(2);
    expect(container.children![0].type).toBe("Hero");
    expect(container.children![1].type).toBe("Button");
  });

  it("addNodeToContainer adds at a specific index", () => {
    useTreeStore.getState().addSlice("Hero", { heading: "x" });
    const containerId = useTreeStore.getState().nodes[0].children![0].id;

    useTreeStore.getState().addNodeToContainer(containerId, "Button", { label: "Click" });
    useTreeStore.getState().addNodeToContainer(containerId, "TextBlock", { text: "Middle" }, 1);

    const container = useTreeStore.getState().nodes[0].children![0];
    expect(container.children).toHaveLength(3);
    expect(container.children![0].type).toBe("Hero");
    expect(container.children![1].type).toBe("TextBlock");
    expect(container.children![2].type).toBe("Button");
  });

  it("reorderNode moves a node up within its parent", () => {
    useTreeStore.getState().addSlice("Hero", { heading: "x" });
    const containerId = useTreeStore.getState().nodes[0].children![0].id;
    useTreeStore.getState().addNodeToContainer(containerId, "Button", { label: "y" });

    const buttonId = useTreeStore.getState().nodes[0].children![0].children![1].id;
    useTreeStore.getState().reorderNode(buttonId, "up");

    const children = useTreeStore.getState().nodes[0].children![0].children!;
    expect(children[0].type).toBe("Button");
    expect(children[1].type).toBe("Hero");
  });

  it("reorderNode moves a node down", () => {
    useTreeStore.getState().addSlice("Hero", { heading: "x" });
    const containerId = useTreeStore.getState().nodes[0].children![0].id;
    useTreeStore.getState().addNodeToContainer(containerId, "Button", { label: "y" });

    const heroId = useTreeStore.getState().nodes[0].children![0].children![0].id;
    useTreeStore.getState().reorderNode(heroId, "down");

    const children = useTreeStore.getState().nodes[0].children![0].children!;
    expect(children[0].type).toBe("Button");
    expect(children[1].type).toBe("Hero");
  });

  it("reorderNode does nothing at boundary", () => {
    useTreeStore.getState().addSlice("Hero", { heading: "x" });
    const heroId = useTreeStore.getState().nodes[0].children![0].children![0].id;

    // Already first — moving up should be a no-op
    useTreeStore.getState().reorderNode(heroId, "up");
    expect(useTreeStore.getState().nodes[0].children![0].children![0].type).toBe("Hero");
  });

  it("setTree replaces the entire tree", () => {
    useTreeStore.getState().addSlice("Hero", { heading: "x" });
    useTreeStore.getState().selectNode("something");

    useTreeStore.getState().setTree([{ id: "new", type: "TextBlock", props: { text: "Fresh" } }]);

    const { nodes, selectedNodeId } = useTreeStore.getState();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("TextBlock");
    expect(selectedNodeId).toBeNull();
  });

  it("replaceTree replaces the entire tree", () => {
    useTreeStore.getState().addSlice("Hero", { heading: "x" });
    useTreeStore.getState().replaceTree([{ id: "r", type: "Button", props: { label: "R" } }]);

    const { nodes } = useTreeStore.getState();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("Button");
  });
});
