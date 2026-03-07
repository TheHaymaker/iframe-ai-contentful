import type { ComponentTreeNode } from "../types";

interface Props {
  nodes: ComponentTreeNode[];
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}

/** Recursive tree outline in the sidebar — shows the component hierarchy */
export function TreeOutline({ nodes, selectedNodeId, onSelect, depth = 0 }: Props) {
  return (
    <div>
      {nodes.map((node) => {
        const isSelected = node.id === selectedNodeId;
        return (
          <div key={node.id}>
            <button
              type="button"
              onClick={() => onSelect(node.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "4px 8px",
                paddingLeft: 8 + depth * 16,
                border: "none",
                borderLeft: isSelected ? "3px solid #3b82f6" : "3px solid transparent",
                backgroundColor: isSelected ? "#eff6ff" : "transparent",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "monospace",
                color: isSelected ? "#1d4ed8" : "#334155",
                transition: "background-color 0.1s",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = "#f1f5f9";
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {node.type}
              <span style={{ color: "#94a3b8", marginLeft: 6, fontSize: 10 }}>
                {node.id.slice(0, 6)}
              </span>
            </button>
            {node.children && node.children.length > 0 && (
              <TreeOutline
                nodes={node.children}
                selectedNodeId={selectedNodeId}
                onSelect={onSelect}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
