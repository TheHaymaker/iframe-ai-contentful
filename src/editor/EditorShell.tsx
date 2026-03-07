import { useEffect, useRef, useCallback } from "react";
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

      {/* iframe preview */}
      <div
        style={{ flex: 1, backgroundColor: "#f1f5f9", position: "relative" }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
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
