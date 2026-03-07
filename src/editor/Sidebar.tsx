import { useState } from "react";
import { ComponentPalette } from "./ComponentPalette";
import { TreeOutline } from "./TreeOutline";
import { PropEditor } from "./PropEditor";
import { findNode } from "../lib/treeUtils";
import type { ComponentTreeNode } from "../types";

interface Props {
  nodes: ComponentTreeNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onAddSlice: (componentType: string, defaultProps: Record<string, unknown>) => void;
  onUpdateProps: (id: string, props: Record<string, unknown>) => void;
  onRemoveNode: (id: string) => void;
  onReorderNode: (id: string, direction: "up" | "down") => void;
}

type Tab = "palette" | "tree" | "props";

export function Sidebar({
  nodes,
  selectedNodeId,
  onSelectNode,
  onAddSlice,
  onUpdateProps,
  onRemoveNode,
  onReorderNode,
}: Props) {
  const [tab, setTab] = useState<Tab>("palette");

  const selectedNode = selectedNodeId ? findNode(nodes, selectedNodeId) : null;
  // Auto-switch to props tab when a node is selected
  const activeTab = selectedNode && tab === "palette" ? "props" : tab;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#f8fafc",
        }}
      >
        {(["palette", "tree", "props"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "8px 0",
              border: "none",
              borderBottom: activeTab === t ? "2px solid #3b82f6" : "2px solid transparent",
              backgroundColor: "transparent",
              color: activeTab === t ? "#1d4ed8" : "#64748b",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {activeTab === "palette" && <ComponentPalette onAddSlice={onAddSlice} />}
        {activeTab === "tree" && (
          <div style={{ padding: "8px 0" }}>
            {nodes.length > 0 ? (
              <TreeOutline
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                onSelect={(id) => {
                  onSelectNode(id);
                  setTab("props");
                }}
              />
            ) : (
              <p style={{ padding: 12, color: "#94a3b8", fontSize: 13 }}>
                No components yet. Add one from the palette.
              </p>
            )}
          </div>
        )}
        {activeTab === "props" && selectedNode && (
          <PropEditor
            node={selectedNode}
            onUpdate={onUpdateProps}
            onRemove={onRemoveNode}
            onReorder={onReorderNode}
          />
        )}
        {activeTab === "props" && !selectedNode && (
          <p style={{ padding: 12, color: "#94a3b8", fontSize: 13 }}>
            Select a component to edit its props.
          </p>
        )}
      </div>
    </div>
  );
}
