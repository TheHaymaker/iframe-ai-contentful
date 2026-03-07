import { useEffect, useRef, useCallback, useState } from "react";
import { flushSync } from "react-dom";
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

  // ── Drag state ─────────────────────────────────────────────────────
  // isDragging: controls whether the drop-capture overlay is in the DOM.
  // We use flushSync so the overlay is committed synchronously on dragstart,
  // before the cursor can reach the iframe. An iframe captures all HTML5 DnD
  // events at the browser level regardless of CSS pointer-events; the only
  // reliable fix is a parent-document element with z-index above the iframe.
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const onDragStart = () => flushSync(() => setIsDragging(true));
    const onDragEnd = () => { setIsDragging(false); setIsDragOver(false); };
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

  // ── Drop handlers (attached to the drag overlay, not the wrapper div) ─
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

      {/* Preview area */}
      <div
        style={{
          flex: 1,
          backgroundColor: "#e2e8f0",
          position: "relative",
          padding: 16,
        }}
      >
        {/* Inner frame — gives the iframe a distinct border + shadow */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            overflow: "hidden",
            backgroundColor: "#ffffff",
          }}
        >
          {/* Drop-capture overlay — always in the DOM so there is no mount
              race with the cursor reaching the iframe. pointer-events: none
              during idle so normal iframe clicks pass through; switched to
              `all` synchronously on dragstart so the overlay intercepts every
              DnD event before the iframe can swallow it. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 10,
              borderRadius: 8,
              pointerEvents: isDragging ? "all" : "none",
              backgroundColor: isDragOver ? "rgba(59, 130, 246, 0.08)" : "transparent",
              border: isDragOver ? "2px dashed #3b82f6" : "2px dashed transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 600,
              color: "#3b82f6",
              fontFamily: "system-ui",
              gap: 8,
              transition: "background-color 0.1s, border-color 0.1s",
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {isDragOver && (
              <>
                <span style={{ fontSize: 24 }}>+</span> Drop to add component
              </>
            )}
          </div>
          <iframe
            ref={iframeRef}
            src="/preview.html"
            title="Preview"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
            }}
          />
        </div>
      </div>
    </div>
  );
}
