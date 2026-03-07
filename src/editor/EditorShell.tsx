import { useEffect, useRef, useCallback, useState } from "react";
import { flushSync } from "react-dom";
import { useTreeStore } from "../store/treeStore";
import { Sidebar } from "./Sidebar";
import {
  postToPreview,
  listenInEditor,
  type PreviewMessage,
} from "../lib/postMessageBridge";
import { getDragPayload, setDragPayload } from "./dragState";

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
    const onDragEnd = () => {
      setDragPayload(null); // clear module-level ref on cancel/end
      setIsDragging(false);
      setIsDragOver(false);
    };
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragend", onDragEnd);
    return () => {
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragend", onDragEnd);
    };
  }, []);

  // ── Document-level capture-phase DnD listeners ─────────────────────────
  // Attaching to `document` in the capture phase (third arg = true) means
  // these fire at the very top of the propagation tree, before the event
  // can reach any child element — including the <iframe>.
  //
  // We read the component payload from the module-level dragState ref rather
  // than from e.dataTransfer.getData().  getData() is unreliable here because:
  //   • some browsers return "" when called in the capture phase of drop
  //   • if the browser routes the drop into the iframe's browsing context
  //     the parent document may never see a drop event at all
  // By storing the payload during dragstart (always in the parent document)
  // we sidestep both problems.
  useEffect(() => {
    const onDragOverCapture = (e: DragEvent) => {
      console.log("[DnD] dragover capture — target:", e.target, "types:", e.dataTransfer?.types);
      if (!getDragPayload()) return; // not one of our component drags
      console.log("[DnD] dragover capture — payload matched, calling preventDefault");
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    };

    const onDropCapture = (e: DragEvent) => {
      console.log("[DnD] drop capture — target:", e.target);
      const payload = getDragPayload();
      if (!payload) return;
      console.log("[DnD] drop capture — payload matched:", payload.componentType);
      e.preventDefault();
      e.stopPropagation();
      setDragPayload(null);
      setIsDragOver(false);
      setIsDragging(false);
      console.log("[DnD] calling addSlice:", payload.componentType);
      addSlice(payload.componentType, payload.defaultProps);
    };

    document.addEventListener("dragover", onDragOverCapture, true);
    document.addEventListener("drop", onDropCapture, true);
    return () => {
      document.removeEventListener("dragover", onDragOverCapture, true);
      document.removeEventListener("drop", onDropCapture, true);
    };
  }, [addSlice]);

  // ── Sync tree to iframe whenever it changes ────────────────────────
  useEffect(() => {
    console.log("[DnD] SET_TREE syncing, nodes.length:", nodes.length);
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

  // handleDragOver / handleDragLeave are kept on the overlay for the visual
  // feedback ring; the actual drop is handled by the capture-phase listeners
  // above so the iframe never swallows the event.
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
