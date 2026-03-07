import { useState, useCallback } from "react";
import { useHubStore } from "../store";
import { TreeViewer } from "../components/TreeViewer";
import { validateTree } from "../../lib/treeUtils";
import type { ComponentTreeNode, HubMessage } from "../../types";

interface Props {
  postMessage: (msg: HubMessage) => void;
}

export function ImportTab({ postMessage }: Props) {
  const {
    subscribers,
    importJson,
    setImportJson,
    importError,
    setImportError,
  } = useHubStore();
  const [parsedTree, setParsedTree] = useState<ComponentTreeNode[] | null>(null);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState<"append" | "replace">("append");
  const [sent, setSent] = useState(false);

  const subscriberList = Array.from(subscribers.entries());

  const handleJsonChange = useCallback(
    (value: string) => {
      setImportJson(value);
      setSent(false);

      if (!value.trim()) {
        setParsedTree(null);
        setImportError(null);
        return;
      }

      try {
        const parsed = JSON.parse(value);
        // Accept both a single node and an array
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        if (validateTree(arr)) {
          setParsedTree(arr);
          setImportError(null);
        } else {
          setParsedTree(null);
          setImportError("Invalid structure: each node must have id (string), type (string), and props (object).");
        }
      } catch (e) {
        setParsedTree(null);
        setImportError(`Invalid JSON: ${(e as Error).message}`);
      }
    },
    [setImportJson, setImportError],
  );

  const { getSelectedTargetIds } = useHubStore();

  const handleSend = useCallback(() => {
    if (!parsedTree) return;

    const targetIds = getSelectedTargetIds();
    if (targetIds.length === 0) {
      setImportError("No target iframes selected. Check the targets above.");
      return;
    }

    postMessage({
      type: "IMPORT_TREE",
      payload: parsedTree,
      sourceId: "hub",
      targetIds,
    });
    setSent(true);
  }, [parsedTree, getSelectedTargetIds, postMessage, setImportError]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Merge mode toggle */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>Mode:</span>
        {(["append", "replace"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setMergeMode(mode)}
            style={{
              padding: "4px 12px",
              border: mergeMode === mode ? "2px solid #3b82f6" : "1px solid #e2e8f0",
              borderRadius: 4,
              backgroundColor: mergeMode === mode ? "#eff6ff" : "#fff",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: mergeMode === mode ? 600 : 400,
              textTransform: "capitalize",
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* JSON input */}
      <textarea
        value={importJson}
        onChange={(e) => handleJsonChange(e.target.value)}
        placeholder={'Paste ComponentTreeNode[] JSON here...\n\n[\n  {\n    "id": "...",\n    "type": "Hero",\n    "props": { "heading": "Hello" }\n  }\n]'}
        style={{
          width: "100%",
          minHeight: 160,
          padding: 12,
          border: importError ? "2px solid #ef4444" : "1px solid #e2e8f0",
          borderRadius: 6,
          fontFamily: "'Fira Code', monospace",
          fontSize: 12,
          lineHeight: 1.5,
          resize: "vertical",
          outline: "none",
        }}
      />

      {/* Error message */}
      {importError && (
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            fontSize: 12,
            color: "#991b1b",
          }}
        >
          {importError}
        </div>
      )}

      {/* Preview */}
      {parsedTree && (
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b", textTransform: "uppercase" }}>
            Preview ({parsedTree.length} node{parsedTree.length !== 1 ? "s" : ""})
          </h4>
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              padding: "8px 0",
              maxHeight: 200,
              overflowY: "auto",
              backgroundColor: "#fff",
            }}
          >
            <TreeViewer
              nodes={parsedTree}
              selectedNodeId={previewNodeId}
              onSelect={setPreviewNodeId}
            />
          </div>
        </div>
      )}

      {/* Send button */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={handleSend}
          disabled={!parsedTree || getSelectedTargetIds().length === 0}
          style={{
            padding: "8px 24px",
            backgroundColor: parsedTree && getSelectedTargetIds().length > 0 ? "#3b82f6" : "#94a3b8",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: parsedTree && getSelectedTargetIds().length > 0 ? "pointer" : "not-allowed",
          }}
        >
          Import to {getSelectedTargetIds().length} target{getSelectedTargetIds().length !== 1 ? "s" : ""}
        </button>
        {sent && (
          <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
            Sent!
          </span>
        )}
      </div>
    </div>
  );
}
