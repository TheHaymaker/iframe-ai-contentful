import { useState, useCallback } from "react";
import { useHubStore } from "../store";
import { TreeViewer } from "../components/TreeViewer";
import { JsonPreview } from "../components/JsonPreview";
import { findNode } from "../../lib/treeUtils";
import type { HubMessage } from "../../types";

interface Props {
  postMessage: (msg: HubMessage) => void;
}

export function ExportTab({ postMessage }: Props) {
  const {
    subscribers,
    selectedSourceId,
    selectedNodePath,
    selectSource,
    selectNode,
  } = useHubStore();
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const subscriberList = Array.from(subscribers.entries());
  const activeEntry = selectedSourceId ? subscribers.get(selectedSourceId) : null;
  const tree = activeEntry?.tree ?? [];
  const selectedNodeData = selectedNodePath ? findNode(tree, selectedNodePath) : null;

  // Auto-select first subscriber if none selected
  if (!selectedSourceId && subscriberList.length > 0) {
    selectSource(subscriberList[0][0]);
  }

  const requestSnapshot = useCallback(() => {
    if (selectedSourceId) {
      postMessage({
        type: "REQUEST_SNAPSHOT",
        sourceId: "hub",
        targetIds: [selectedSourceId],
      });
    }
  }, [selectedSourceId, postMessage]);

  const copyToClipboard = useCallback(
    async (data: unknown, label: string) => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setCopyFeedback(`${label} copied!`);
        setTimeout(() => setCopyFeedback(null), 2000);
      } catch {
        setCopyFeedback("Copy failed");
        setTimeout(() => setCopyFeedback(null), 2000);
      }
    },
    [],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Source selector */}
      {subscriberList.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {subscriberList.map(([id, entry]) => (
            <button
              key={id}
              type="button"
              onClick={() => selectSource(id)}
              style={{
                padding: "4px 10px",
                border: selectedSourceId === id ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                borderRadius: 4,
                backgroundColor: selectedSourceId === id ? "#eff6ff" : "#fff",
                cursor: "pointer",
                fontSize: 11,
                fontFamily: "monospace",
              }}
            >
              {entry.meta.title} ({id.slice(0, 6)})
            </button>
          ))}
        </div>
      )}

      {/* Actions bar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" onClick={requestSnapshot} style={actionBtnStyle}>
          Refresh
        </button>
        <button
          type="button"
          onClick={() => copyToClipboard(tree, "Tree")}
          disabled={tree.length === 0}
          style={actionBtnStyle}
        >
          Copy All
        </button>
        {selectedNodeData && (
          <button
            type="button"
            onClick={() => copyToClipboard(selectedNodeData, "Node")}
            style={actionBtnStyle}
          >
            Copy Node
          </button>
        )}
        {copyFeedback && (
          <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
            {copyFeedback}
          </span>
        )}
      </div>

      {/* Tree + detail split */}
      {tree.length > 0 ? (
        <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
          {/* Tree viewer */}
          <div
            style={{
              flex: 1,
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              overflowY: "auto",
              padding: "8px 0",
              backgroundColor: "#fff",
            }}
          >
            <TreeViewer
              nodes={tree}
              selectedNodeId={selectedNodePath}
              onSelect={selectNode}
            />
          </div>

          {/* Detail pane */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {selectedNodeData ? (
              <JsonPreview data={selectedNodeData} />
            ) : (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 13,
                  border: "1px dashed #e2e8f0",
                  borderRadius: 6,
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Select a node to view its JSON
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            color: "#94a3b8",
            fontSize: 14,
          }}
        >
          {subscriberList.length === 0
            ? "No iframes connected. Open the editor and click \"Open Hub\"."
            : "No tree data yet. Click Refresh to request a snapshot."}
        </div>
      )}
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  border: "1px solid #e2e8f0",
  borderRadius: 5,
  backgroundColor: "#fff",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "system-ui",
};
