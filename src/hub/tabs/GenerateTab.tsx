import { useState, useCallback, useRef } from "react";
import { useHubStore } from "../store";
import { TreeViewer } from "../components/TreeViewer";
import { JsonPreview } from "../components/JsonPreview";
import { validateTree } from "../../lib/treeUtils";
import { featureMap } from "../../config/featureMap";
import type { ComponentTreeNode, HubMessage } from "../../types";

interface Props {
  postMessage: (msg: HubMessage) => void;
}

/**
 * Generate tab — upload a screenshot/design image and (in the future)
 * send it to an AI model along with the feature map to generate
 * ComponentTreeNode[] JSON.
 *
 * For now this tab provides:
 * - Image drop zone with clipboard paste support
 * - Feature map reference (what the AI will see)
 * - Manual JSON result input for testing the flow
 * - Apply button to send generated tree to iframes
 */
export function GenerateTab({ postMessage }: Props) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [resultJson, setResultJson] = useState("");
  const [parsedResult, setParsedResult] = useState<ComponentTreeNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Image handling ─────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    },
    [handleFile],
  );

  // ── Result JSON handling ───────────────────────────────────────────
  const handleResultChange = useCallback((value: string) => {
    setResultJson(value);
    setSent(false);
    if (!value.trim()) {
      setParsedResult(null);
      setError(null);
      return;
    }
    try {
      const parsed = JSON.parse(value);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      if (validateTree(arr)) {
        setParsedResult(arr);
        setError(null);
      } else {
        setParsedResult(null);
        setError("Invalid ComponentTreeNode structure.");
      }
    } catch (e) {
      setParsedResult(null);
      setError(`Invalid JSON: ${(e as Error).message}`);
    }
  }, []);

  const { getSelectedTargetIds } = useHubStore();

  const handleApply = useCallback(() => {
    if (!parsedResult) return;
    const targetIds = getSelectedTargetIds();
    if (targetIds.length === 0) {
      setError("No target iframes selected. Check the targets above.");
      return;
    }
    postMessage({
      type: "GENERATE_RESULT",
      payload: parsedResult,
      sourceId: "hub",
      targetIds,
    });
    setSent(true);
  }, [parsedResult, getSelectedTargetIds, postMessage]);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}
      onPaste={handlePaste}
    >
      {/* Image drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: "2px dashed #cbd5e1",
          borderRadius: 8,
          padding: imagePreview ? 8 : 32,
          textAlign: "center",
          cursor: "pointer",
          backgroundColor: "#f8fafc",
          transition: "border-color 0.15s",
        }}
      >
        {imagePreview ? (
          <img
            src={imagePreview}
            alt="Uploaded design"
            style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 4 }}
          />
        ) : (
          <div>
            <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
              Drop a screenshot here, paste from clipboard, or click to upload
            </p>
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>
              The AI will analyze this image to generate components
            </p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {/* Feature map reference */}
      <details style={{ fontSize: 12 }}>
        <summary style={{ cursor: "pointer", color: "#64748b", fontWeight: 600 }}>
          Available Components ({featureMap.length})
        </summary>
        <div
          style={{
            marginTop: 8,
            maxHeight: 160,
            overflowY: "auto",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            padding: 8,
          }}
        >
          {featureMap.map((entry) => (
            <div key={entry.componentType} style={{ marginBottom: 6 }}>
              <strong>{entry.componentType}</strong>
              {entry.isContainer && (
                <span style={{ color: "#3b82f6", fontSize: 10, marginLeft: 4 }}>container</span>
              )}
              <br />
              <span style={{ color: "#94a3b8" }}>{entry.description}</span>
            </div>
          ))}
        </div>
      </details>

      {/* AI call placeholder */}
      <div
        style={{
          padding: 16,
          backgroundColor: "#fefce8",
          border: "1px solid #fde68a",
          borderRadius: 6,
          fontSize: 12,
          color: "#92400e",
        }}
      >
        AI generation will call a vision model with the uploaded image + feature map.
        For now, paste generated JSON below to test the flow.
      </div>

      {/* Result JSON input */}
      <textarea
        value={resultJson}
        onChange={(e) => handleResultChange(e.target.value)}
        placeholder="Paste or edit generated ComponentTreeNode[] JSON..."
        style={{
          width: "100%",
          minHeight: 120,
          padding: 12,
          border: error ? "2px solid #ef4444" : "1px solid #e2e8f0",
          borderRadius: 6,
          fontFamily: "'Fira Code', monospace",
          fontSize: 12,
          lineHeight: 1.5,
          resize: "vertical",
          outline: "none",
        }}
      />

      {error && (
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
          {error}
        </div>
      )}

      {/* Result preview */}
      {parsedResult && (
        <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
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
              nodes={parsedResult}
              selectedNodeId={previewNodeId}
              onSelect={setPreviewNodeId}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {previewNodeId ? (
              <JsonPreview
                data={parsedResult.find((n) => n.id === previewNodeId) ?? parsedResult}
              />
            ) : (
              <JsonPreview data={parsedResult} />
            )}
          </div>
        </div>
      )}

      {/* Apply button */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={handleApply}
          disabled={!parsedResult || getSelectedTargetIds().length === 0}
          style={{
            padding: "8px 24px",
            backgroundColor: parsedResult && getSelectedTargetIds().length > 0 ? "#8b5cf6" : "#94a3b8",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: parsedResult && getSelectedTargetIds().length > 0 ? "pointer" : "not-allowed",
          }}
        >
          Apply to {getSelectedTargetIds().length} target{getSelectedTargetIds().length !== 1 ? "s" : ""}
        </button>
        {sent && (
          <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
            Applied!
          </span>
        )}
      </div>
    </div>
  );
}
