import { useState } from "react";
import type { ComponentTreeNode } from "../../types";

interface Props {
  nodes: ComponentTreeNode[];
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}

/**
 * Recursive collapsible tree viewer used in the Export and Import tabs.
 * Shows component type, id, and expandable props/children.
 */
export function TreeViewer({ nodes, selectedNodeId, onSelect, depth = 0 }: Props) {
  return (
    <div>
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          selectedNodeId={selectedNodeId}
          onSelect={onSelect}
          depth={depth}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  selectedNodeId,
  onSelect,
  depth,
}: {
  node: ComponentTreeNode;
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isSelected = node.id === selectedNodeId;
  const hasChildren = node.children && node.children.length > 0;
  const propCount = Object.keys(node.props).length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingLeft: depth * 16,
          padding: "3px 8px",
          paddingLeft: 8 + depth * 16,
          backgroundColor: isSelected ? "#eff6ff" : "transparent",
          borderLeft: isSelected ? "3px solid #3b82f6" : "3px solid transparent",
          cursor: "pointer",
          fontSize: 12,
          fontFamily: "monospace",
          transition: "background-color 0.1s",
        }}
        onClick={() => onSelect(node.id)}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = "#f8fafc";
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        {/* Expand toggle */}
        <span
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          style={{
            width: 16,
            textAlign: "center",
            color: "#94a3b8",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {hasChildren || propCount > 0 ? (expanded ? "\u25BC" : "\u25B6") : "\u00B7"}
        </span>

        {/* Type badge */}
        <span
          style={{
            backgroundColor: hasChildren ? "#dbeafe" : "#f1f5f9",
            color: hasChildren ? "#1d4ed8" : "#475569",
            padding: "1px 6px",
            borderRadius: 3,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {node.type}
        </span>

        {/* Id */}
        <span style={{ color: "#94a3b8", fontSize: 10 }}>{node.id.slice(0, 8)}</span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ paddingLeft: 8 + depth * 16 + 20 }}>
          {/* Props */}
          {propCount > 0 && (
            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, margin: "2px 0" }}>
              {Object.entries(node.props).map(([key, val]) => (
                <div key={key}>
                  <span style={{ color: "#8b5cf6" }}>{key}</span>
                  <span style={{ color: "#94a3b8" }}>: </span>
                  <span style={{ color: "#059669" }}>
                    {typeof val === "string"
                      ? `"${val.length > 40 ? val.slice(0, 40) + "..." : val}"`
                      : String(val)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Children */}
          {hasChildren && (
            <TreeViewer
              nodes={node.children!}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          )}
        </div>
      )}
    </div>
  );
}
