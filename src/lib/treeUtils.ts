import { v4 as uuid } from "uuid";
import type { ComponentTreeNode, SectionProps, ContainerProps } from "../types";

/**
 * Wrap a list of component nodes in a Section > Container shell.
 * This produces a self-contained "slice" that users can copy/paste as one unit.
 */
export function wrapInSlice(
  children: ComponentTreeNode[],
  sectionProps: Partial<SectionProps> = {},
  containerProps: Partial<ContainerProps> = {},
): ComponentTreeNode {
  return {
    id: uuid(),
    type: "Section",
    props: { ...sectionProps },
    children: [
      {
        id: uuid(),
        type: "Container",
        props: { ...containerProps },
        children,
      },
    ],
  };
}

/** Create a single leaf node with auto-generated id */
export function createNode(
  type: string,
  props: Record<string, unknown>,
): ComponentTreeNode {
  return { id: uuid(), type, props };
}

/** Deep-clone a tree, regenerating all ids so pasted slices don't collide */
export function cloneWithNewIds(nodes: ComponentTreeNode[]): ComponentTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    id: uuid(),
    props: { ...node.props },
    children: node.children ? cloneWithNewIds(node.children) : undefined,
  }));
}

/** Find a node by id anywhere in the tree */
export function findNode(
  nodes: ComponentTreeNode[],
  id: string,
): ComponentTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/** Count total nodes in a tree */
export function countNodes(nodes: ComponentTreeNode[]): number {
  return nodes.reduce(
    (sum, node) => sum + 1 + (node.children ? countNodes(node.children) : 0),
    0,
  );
}

/** Validate that a JSON value conforms to ComponentTreeNode[] shape */
export function validateTree(data: unknown): data is ComponentTreeNode[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (node) =>
      typeof node === "object" &&
      node !== null &&
      typeof node.id === "string" &&
      typeof node.type === "string" &&
      typeof node.props === "object" &&
      node.props !== null &&
      (node.children === undefined || validateTree(node.children)),
  );
}
