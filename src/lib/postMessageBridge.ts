import type { ComponentTreeNode } from "../types";

// ── Message types between editor shell ↔ iframe preview ─────────────
export type EditorMessage =
  | { type: "SET_TREE"; payload: ComponentTreeNode[] }
  | { type: "UPDATE_PROPS"; nodeId: string; props: Record<string, unknown> }
  | { type: "SELECT_NODE"; nodeId: string | null }
  | { type: "REMOVE_NODE"; nodeId: string }
  | { type: "ADD_NODE"; containerId: string; componentType: string; props: Record<string, unknown>; index?: number }
  | { type: "REORDER_NODE"; nodeId: string; direction: "up" | "down" };

export type PreviewMessage =
  | { type: "PREVIEW_READY" }
  | { type: "NODE_CLICKED"; nodeId: string }
  | { type: "TREE_UPDATED"; payload: ComponentTreeNode[] };

const ORIGIN = "*"; // same-origin iframe; tighten in production

/** Send a typed message from the editor shell to the iframe preview */
export function postToPreview(
  iframeRef: HTMLIFrameElement | null,
  message: EditorMessage,
) {
  iframeRef?.contentWindow?.postMessage(message, ORIGIN);
}

/** Send a typed message from the iframe preview to the parent editor */
export function postToEditor(message: PreviewMessage) {
  window.parent.postMessage(message, ORIGIN);
}

/** Subscribe to messages in the editor shell (from iframe) */
export function listenInEditor(
  handler: (msg: PreviewMessage) => void,
): () => void {
  const onMessage = (event: MessageEvent) => {
    if (event.data && typeof event.data.type === "string") {
      handler(event.data as PreviewMessage);
    }
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}

/** Subscribe to messages in the iframe preview (from editor) */
export function listenInPreview(
  handler: (msg: EditorMessage) => void,
): () => void {
  const onMessage = (event: MessageEvent) => {
    if (event.data && typeof event.data.type === "string") {
      handler(event.data as EditorMessage);
    }
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
