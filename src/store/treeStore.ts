import { create } from "zustand";
import { v4 as uuid } from "uuid";
import type { ComponentTreeNode } from "../types";
import { wrapInSlice, createNode } from "../lib/treeUtils";

interface TreeState {
  nodes: ComponentTreeNode[];
  selectedNodeId: string | null;

  // ── Selection ──────────────────────────────────────────────────────
  selectNode: (id: string | null) => void;

  // ── Tree mutations ─────────────────────────────────────────────────
  setTree: (nodes: ComponentTreeNode[]) => void;
  addSlice: (componentType: string, defaultProps: Record<string, unknown>) => void;
  addNodeToContainer: (
    containerId: string,
    componentType: string,
    props: Record<string, unknown>,
    index?: number,
  ) => void;
  removeNode: (id: string) => void;
  updateNodeProps: (id: string, props: Record<string, unknown>) => void;
  reorderNode: (id: string, direction: "up" | "down") => void;
  replaceTree: (nodes: ComponentTreeNode[]) => void;
}

/** Recursively update a node's props by id */
function updateInTree(
  nodes: ComponentTreeNode[],
  id: string,
  props: Record<string, unknown>,
): ComponentTreeNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, props: { ...node.props, ...props } };
    }
    if (node.children) {
      return { ...node, children: updateInTree(node.children, id, props) };
    }
    return node;
  });
}

/** Recursively remove a node by id */
function removeFromTree(
  nodes: ComponentTreeNode[],
  id: string,
): ComponentTreeNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => {
      if (node.children) {
        return { ...node, children: removeFromTree(node.children, id) };
      }
      return node;
    });
}

/** Insert a child into a specific container node at an index */
function insertIntoContainer(
  nodes: ComponentTreeNode[],
  containerId: string,
  child: ComponentTreeNode,
  index?: number,
): ComponentTreeNode[] {
  return nodes.map((node) => {
    if (node.id === containerId) {
      const children = [...(node.children || [])];
      const insertAt = index !== undefined ? index : children.length;
      children.splice(insertAt, 0, child);
      return { ...node, children };
    }
    if (node.children) {
      return {
        ...node,
        children: insertIntoContainer(node.children, containerId, child, index),
      };
    }
    return node;
  });
}

/** Reorder a node within its parent's children array */
function reorderInTree(
  nodes: ComponentTreeNode[],
  id: string,
  direction: "up" | "down",
): ComponentTreeNode[] {
  // Check if the node is at this level
  const idx = nodes.findIndex((n) => n.id === id);
  if (idx !== -1) {
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= nodes.length) return nodes;
    const result = [...nodes];
    [result[idx], result[newIdx]] = [result[newIdx], result[idx]];
    return result;
  }
  // Recurse into children
  return nodes.map((node) => {
    if (node.children) {
      return { ...node, children: reorderInTree(node.children, id, direction) };
    }
    return node;
  });
}

/** Find the first Container node's id in a tree */
function findFirstContainerId(nodes: ComponentTreeNode[]): string | null {
  for (const node of nodes) {
    if (node.type === "Container") return node.id;
    if (node.children) {
      const found = findFirstContainerId(node.children);
      if (found) return found;
    }
  }
  return null;
}

export const useTreeStore = create<TreeState>((set) => ({
  nodes: [],
  selectedNodeId: null,

  selectNode: (id) => set({ selectedNodeId: id }),

  setTree: (nodes) => set({ nodes, selectedNodeId: null }),

  /** Add a new Section > Container > [component] slice at the root level */
  addSlice: (componentType, defaultProps) =>
    set((state) => ({
      nodes: [
        ...state.nodes,
        wrapInSlice([createNode(componentType, defaultProps)]),
      ],
    })),

  /** Add a component node inside an existing container */
  addNodeToContainer: (containerId, componentType, props, index) =>
    set((state) => {
      const child: ComponentTreeNode = { id: uuid(), type: componentType, props };
      return {
        nodes: insertIntoContainer(state.nodes, containerId, child, index),
      };
    }),

  removeNode: (id) =>
    set((state) => ({
      nodes: removeFromTree(state.nodes, id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    })),

  updateNodeProps: (id, props) =>
    set((state) => ({
      nodes: updateInTree(state.nodes, id, props),
    })),

  reorderNode: (id, direction) =>
    set((state) => ({
      nodes: reorderInTree(state.nodes, id, direction),
    })),

  replaceTree: (nodes) => set({ nodes, selectedNodeId: null }),
}));

export { findFirstContainerId };
