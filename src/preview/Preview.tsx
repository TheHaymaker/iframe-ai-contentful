import { useEffect, useState, useCallback, useMemo } from "react";
import { ComponentRenderer } from "../components";
import {
  listenInPreview,
  postToEditor,
  type EditorMessage,
} from "../lib/postMessageBridge";
import { generateSourceId } from "../constants";
import { HubLauncher } from "./HubLauncher";
import { ChannelBridge } from "./ChannelBridge";
import { cloneWithNewIds } from "../lib/treeUtils";
import type { ComponentTreeNode } from "../types";

/**
 * Preview app rendered inside the iframe.
 * Receives tree updates from the editor via postMessage,
 * renders the component tree, and reports interactions back.
 */
export function Preview() {
  const [nodes, setNodes] = useState<ComponentTreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Stable unique id for this iframe instance (persists across re-renders)
  const sourceId = useMemo(() => generateSourceId(), []);

  // Handler for trees imported via BroadcastChannel from the Hub.
  // Clone with new IDs so each target iframe gets unique node identifiers,
  // preventing collisions when the same tree is broadcast to multiple iframes.
  const handleImportTree = useCallback((imported: ComponentTreeNode[], replace?: boolean) => {
    const cloned = cloneWithNewIds(imported);
    setNodes((prev) => replace ? cloned : [...prev, ...cloned]);
    postToEditor({ type: "TREE_UPDATED", payload: cloned });
  }, []);

  // Apply incoming editor messages to local state
  const handleMessage = useCallback((msg: EditorMessage) => {
    switch (msg.type) {
      case "SET_TREE":
        setNodes(msg.payload);
        break;
      case "UPDATE_PROPS":
        setNodes((prev) => updateProps(prev, msg.nodeId, msg.props));
        break;
      case "SELECT_NODE":
        setSelectedId(msg.nodeId);
        break;
      case "REMOVE_NODE":
        setNodes((prev) => removeNode(prev, msg.nodeId));
        break;
      case "ADD_NODE":
        setNodes((prev) =>
          addToContainer(prev, msg.containerId, msg.componentType, msg.props, msg.index),
        );
        break;
      case "REORDER_NODE":
        setNodes((prev) => reorderNode(prev, msg.nodeId, msg.direction));
        break;
    }
  }, []);

  useEffect(() => {
    const unsub = listenInPreview(handleMessage);
    // Tell editor we're ready
    postToEditor({ type: "PREVIEW_READY" });
    return unsub;
  }, [handleMessage]);

  // Click handler for node selection
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-node-id]");
      if (target) {
        e.stopPropagation();
        const nodeId = target.getAttribute("data-node-id")!;
        setSelectedId(nodeId);
        postToEditor({ type: "NODE_CLICKED", nodeId });
      }
    },
    [],
  );

  return (
    <div
      onClick={handleClick}
      style={{ minHeight: "100vh", position: "relative" }}
    >
      {/* BroadcastChannel bridge to Hub popup */}
      <ChannelBridge nodes={nodes} sourceId={sourceId} onImportTree={handleImportTree} />
      {/* Hub launcher button */}
      <HubLauncher />
      {/* Selection highlight overlay */}
      {selectedId && <SelectionOverlay nodeId={selectedId} />}
      <ComponentRenderer nodes={nodes} />
      {nodes.length === 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            color: "#94a3b8",
            fontSize: 18,
            fontFamily: "system-ui",
          }}
        >
          Drag a component from the palette to get started
        </div>
      )}
    </div>
  );
}

/** Thin blue outline around the selected node */
function SelectionOverlay({ nodeId }: { nodeId: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const el = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (el) setRect(el.getBoundingClientRect());
    else setRect(null);
  }, [nodeId]);

  if (!rect) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        border: "2px solid #3b82f6",
        pointerEvents: "none",
        zIndex: 9999,
        borderRadius: 2,
      }}
    />
  );
}

// ── Local tree helpers (mirror treeStore logic for iframe-side state) ─
function updateProps(
  nodes: ComponentTreeNode[],
  id: string,
  props: Record<string, unknown>,
): ComponentTreeNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, props: { ...n.props, ...props } };
    if (n.children) return { ...n, children: updateProps(n.children, id, props) };
    return n;
  });
}

function removeNode(nodes: ComponentTreeNode[], id: string): ComponentTreeNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) =>
      n.children ? { ...n, children: removeNode(n.children, id) } : n,
    );
}

function addToContainer(
  nodes: ComponentTreeNode[],
  containerId: string,
  type: string,
  props: Record<string, unknown>,
  index?: number,
): ComponentTreeNode[] {
  return nodes.map((n) => {
    if (n.id === containerId) {
      const children = [...(n.children || [])];
      const child: ComponentTreeNode = {
        id: crypto.randomUUID(),
        type,
        props,
      };
      children.splice(index ?? children.length, 0, child);
      return { ...n, children };
    }
    if (n.children)
      return {
        ...n,
        children: addToContainer(n.children, containerId, type, props, index),
      };
    return n;
  });
}

function reorderNode(
  nodes: ComponentTreeNode[],
  id: string,
  direction: "up" | "down",
): ComponentTreeNode[] {
  const idx = nodes.findIndex((n) => n.id === id);
  if (idx !== -1) {
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= nodes.length) return nodes;
    const result = [...nodes];
    [result[idx], result[newIdx]] = [result[newIdx], result[idx]];
    return result;
  }
  return nodes.map((n) =>
    n.children ? { ...n, children: reorderNode(n.children, id, direction) } : n,
  );
}
