import { useEffect, useRef, useCallback, useState } from "react";
import { useTreeStore } from "../store/treeStore";
import { Sidebar } from "./Sidebar";
import {
  postToPreview,
  listenInEditor,
  type PreviewMessage,
} from "../lib/postMessageBridge";

export function EditorShell() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const {
    nodes,
    selectedNodeId,
    selectNode,
    addSlice,
    updateNodeProps,
    removeNode,
    reorderNode,
  } = useTreeStore();

  // ── Track drag state so we can punch through the iframe ───────────
  // Use direct DOM mutation (not React state) so pointer-events are disabled
  // synchronously on dragstart — before the cursor can enter the iframe.
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const onDragStart = () => {
      if (iframeRef.current) iframeRef.current.style.pointerEvents = "none";
    };
    const onDragEnd = () => {
      if (iframeRef.current) iframeRef.current.style.pointerEvents = "";
      setIsDragOver(false);
    };
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragend", onDragEnd);
    return () => {
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragend", onDragEnd);
    };
  }, []);

  // ── Sync tree to iframe whenever it changes ────────────────────────
  useEffect(() => {
    postToPreview(iframeRef.current, { type: "SET_TREE", payload: nodes });
  }, [nodes]);

  // ── Sync selection to iframe ───────────────────────────────────────
  useEffect(() => {
    postToPreview(iframeRef.current, { type: "SELECT_NODE", nodeId: selectedNodeId });
  }, [selectedNodeId]);

  // ── Listen for messages from iframe ────────────────────────────────
  const { setTree } = useTreeStore.getState();
  useEffect(() => {
    return listenInEditor((msg: PreviewMessage) => {
      switch (msg.type) {
        case "PREVIEW_READY":
          // iframe just loaded — send current tree
          postToPreview(iframeRef.current, { type: "SET_TREE", payload: useTreeStore.getState().nodes });
          break;
        case "NODE_CLICKED":
          selectNode(msg.nodeId);
          break;
        case "TREE_UPDATED":
          // Hub imported new nodes into the iframe — sync to editor store
          useTreeStore.getState().setTree([
            ...useTreeStore.getState().nodes,
            ...msg.payload,
          ]);
          break;
      }
    });
  }, [selectNode, setTree]);

  // ── Drop handler for components dragged from palette onto iframe ──
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const data = e.dataTransfer.getData("application/x-component");
      if (!data) return;
      const { componentType, defaultProps } = JSON.parse(data);
      addSlice(componentType, defaultProps);
    },
    [addSlice],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear when leaving the preview area entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui" }}>
      {/* Sidebar */}
      <div
        style={{
          width: 280,
          minWidth: 280,
          borderRight: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #e2e8f0",
            fontWeight: 700,
            fontSize: 14,
            color: "#0f172a",
          }}
        >
          CMS Editor
        </div>
        <Sidebar
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          onSelectNode={selectNode}
          onAddSlice={addSlice}
          onUpdateProps={updateNodeProps}
          onRemoveNode={removeNode}
          onReorderNode={reorderNode}
        />
      </div>

      {/* iframe preview — pointer-events disabled on iframe during drag so the
          wrapper div can receive dragover/drop events */}
      <div
        style={{
          flex: 1,
          backgroundColor: "#f1f5f9",
          position: "relative",
          transition: "box-shadow 0.15s",
          boxShadow: isDragOver ? "inset 0 0 0 3px #3b82f6" : "none",
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Drop-zone overlay shown while dragging over the preview */}
        {isDragOver && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(59, 130, 246, 0.08)",
              border: "2px dashed #3b82f6",
              zIndex: 10,
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 600,
              color: "#3b82f6",
              fontFamily: "system-ui",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 24 }}>+</span> Drop to add component
          </div>
        )}
        <iframe
          ref={iframeRef}
          src="/preview.html"
          title="Preview"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
        />
      </div>
    </div>
  );
}
